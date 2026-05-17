import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Collect all users with any active connection
  const [gmailConnections, outlookConnections] = await Promise.all([
    db.oAuthConnection.findMany({
      where: { provider: "GMAIL", isActive: true },
      select: { userId: true },
      take: 10,
    }),
    db.oAuthConnection.findMany({
      where: { provider: "OUTLOOK", isActive: true },
      select: { userId: true },
      take: 10,
    }),
  ]);

  const gmailUserIds = [...new Set(gmailConnections.map((c) => c.userId))];
  const outlookUserIds = [...new Set(outlookConnections.map((c) => c.userId))];

  const [gmailResults, outlookResults] = await Promise.all([
    Promise.allSettled(gmailUserIds.map(syncGoogleUser)),
    Promise.allSettled(outlookUserIds.map(syncMicrosoftUser)),
  ]);

  return NextResponse.json({
    success: true,
    google: {
      synced: gmailResults.filter((r) => r.status === "fulfilled").length,
      failed: gmailResults.filter((r) => r.status === "rejected").length,
    },
    microsoft: {
      synced: outlookResults.filter((r) => r.status === "fulfilled").length,
      failed: outlookResults.filter((r) => r.status === "rejected").length,
    },
  });
}

async function syncGoogleUser(userId: string) {
  const { syncGmailIncremental } = await import("@/lib/google/gmail");
  const { processEmailBatch } = await import("@/services/email.service");
  const { syncCalendarIncremental, upsertCalendarEvents } = await import("@/lib/google/calendar");
  const { generateSmartAlerts } = await import("@/services/alerts.service");

  const gmailCursor = await db.syncCursor.findUnique({
    where: { userId_provider: { userId, provider: "GMAIL" } },
  });
  const { messages, newHistoryId } = await syncGmailIncremental(userId, gmailCursor?.cursor ?? undefined);
  await processEmailBatch(userId, messages.slice(0, 30));
  await db.syncCursor.upsert({
    where: { userId_provider: { userId, provider: "GMAIL" } },
    update: { cursor: newHistoryId },
    create: { userId, provider: "GMAIL", cursor: newHistoryId },
  });

  try {
    const calCursor = await db.syncCursor.findUnique({
      where: { userId_provider: { userId, provider: "GOOGLE_CALENDAR" } },
    });
    const { events, newSyncToken } = await syncCalendarIncremental(userId, calCursor?.cursor ?? undefined);
    await upsertCalendarEvents(userId, events);
    if (newSyncToken) {
      await db.syncCursor.upsert({
        where: { userId_provider: { userId, provider: "GOOGLE_CALENDAR" } },
        update: { cursor: newSyncToken },
        create: { userId, provider: "GOOGLE_CALENDAR", cursor: newSyncToken },
      });
    }
  } catch { /* calendar optional */ }

  try { await generateSmartAlerts(userId); } catch { /* non-blocking */ }
}

async function syncMicrosoftUser(userId: string) {
  const { syncOutlookIncremental, isOutlookCruft } = await import("@/lib/microsoft/outlook");
  const { syncMicrosoftCalendarIncremental, microsoftEventToCalendarEvent } = await import("@/lib/microsoft/calendar");
  const { syncTeamsMessages } = await import("@/lib/microsoft/teams");
  const { classifyEmail } = await import("@/lib/openai");
  const { buildMemoryContext } = await import("@/services/memory.service");
  const { generateSmartAlerts } = await import("@/services/alerts.service");

  const CATEGORY_MAP: Record<string, string> = {
    urgent: "URGENT", action_required: "ACTION_REQUIRED", watch: "WATCH",
    informational: "INFORMATIONAL", newsletter: "NEWSLETTER", promo: "PROMO", ignore: "IGNORE",
  };

  // Outlook emails
  const cursor = await db.syncCursor.findUnique({ where: { userId_provider: { userId, provider: "OUTLOOK" } } });
  const { messages, deltaLink } = await syncOutlookIncremental(userId, cursor?.cursor ?? undefined);
  const memCtx = await buildMemoryContext(userId);

  for (const msg of messages.slice(0, 30)) {
    if (isOutlookCruft(msg)) continue;
    const exists = await db.email.findUnique({ where: { outlookMessageId: msg.id } });
    if (exists) continue;
    try {
      const classified = await classifyEmail({ subject: msg.subject, from: msg.fromName ? `${msg.fromName} <${msg.from}>` : msg.from, snippet: msg.snippet, bodyText: msg.bodyText, memoryContext: memCtx, alreadyInformedIds: [] });
      await db.email.create({
        data: {
          userId, emailSource: "OUTLOOK", outlookMessageId: msg.id, outlookThreadId: msg.conversationId,
          subject: msg.subject, fromAddress: msg.from, fromName: msg.fromName, toAddresses: msg.to,
          snippet: msg.snippet, receivedAt: msg.receivedAt, internalDate: BigInt(msg.receivedAt.getTime()),
          importanceScore: classified.importance_score, category: (CATEGORY_MAP[classified.category] ?? "INFORMATIONAL") as any,
          whyImportant: classified.why_important, shortSummary: classified.short_summary,
          actionNeeded: classified.action_needed, dueDate: classified.due_date,
          confidence: classified.confidence, alreadyInformed: classified.already_informed_suggestion,
          classifiedAt: new Date(), labels: [],
        },
      });
    } catch { /* skip individual failures */ }
  }

  if (deltaLink) {
    await db.syncCursor.upsert({ where: { userId_provider: { userId, provider: "OUTLOOK" } }, update: { cursor: deltaLink }, create: { userId, provider: "OUTLOOK", cursor: deltaLink } });
  }

  // Microsoft Calendar
  try {
    const calCursor = await db.syncCursor.findUnique({ where: { userId_provider: { userId, provider: "MICROSOFT_CALENDAR" } } });
    const { events, deltaLink: calDelta } = await syncMicrosoftCalendarIncremental(userId, calCursor?.cursor ?? undefined);
    for (const event of events) {
      const data = microsoftEventToCalendarEvent(userId, event);
      await db.calendarEvent.upsert({ where: { outlookEventId: event.id }, update: { ...data, updatedAt: new Date() }, create: data as any });
    }
    if (calDelta) {
      await db.syncCursor.upsert({ where: { userId_provider: { userId, provider: "MICROSOFT_CALENDAR" } }, update: { cursor: calDelta }, create: { userId, provider: "MICROSOFT_CALENDAR", cursor: calDelta } });
    }
  } catch { /* calendar optional */ }

  // Teams
  try {
    const teamsMessages = await syncTeamsMessages(userId);
    for (const msg of teamsMessages) {
      const exists = await db.teamsMessage.findUnique({ where: { teamsMessageId: msg.id } });
      if (!exists) {
        await db.teamsMessage.create({ data: { userId, teamsMessageId: msg.id, chatId: msg.chatId, chatName: msg.chatName, chatType: msg.chatType, senderName: msg.senderName, senderAddress: msg.senderAddress, content: msg.content, receivedAt: msg.receivedAt } });
      }
    }
  } catch { /* teams optional */ }

  try { await generateSmartAlerts(userId); } catch { /* non-blocking */ }
}
