import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { classifyEmail } from "@/lib/openai";
import { buildMemoryContext } from "@/services/memory.service";
import { generateSmartAlerts } from "@/services/alerts.service";
import { syncOutlookIncremental, isOutlookCruft } from "@/lib/microsoft/outlook";
import { syncMicrosoftCalendarIncremental, microsoftEventToCalendarEvent } from "@/lib/microsoft/calendar";
import { syncTeamsMessages } from "@/lib/microsoft/teams";

const CATEGORY_MAP: Record<string, string> = {
  urgent: "URGENT",
  action_required: "ACTION_REQUIRED",
  watch: "WATCH",
  informational: "INFORMATIONAL",
  newsletter: "NEWSLETTER",
  promo: "PROMO",
  ignore: "IGNORE",
};

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const results: Record<string, any> = {};

  // ── Outlook email sync ────────────────────────────────────────────────────
  try {
    const cursor = await db.syncCursor.findUnique({
      where: { userId_provider: { userId, provider: "OUTLOOK" } },
    });

    const { messages, deltaLink } = await syncOutlookIncremental(
      userId,
      cursor?.cursor ?? undefined
    );

    const memCtx = await buildMemoryContext(userId);
    const alreadyInformedIds = await db.email
      .findMany({ where: { userId, alreadyInformed: true }, select: { outlookMessageId: true } })
      .then((rows) => rows.map((r) => r.outlookMessageId).filter(Boolean) as string[]);

    let succeeded = 0;
    let failed = 0;

    for (const msg of messages.slice(0, 100)) {
      if (isOutlookCruft(msg)) continue;

      const existing = await db.email.findUnique({
        where: { outlookMessageId: msg.id },
      });
      if (existing) continue;

      try {
        const classified = await classifyEmail({
          subject: msg.subject,
          from: msg.fromName ? `${msg.fromName} <${msg.from}>` : msg.from,
          snippet: msg.snippet,
          bodyText: msg.bodyText,
          memoryContext: memCtx,
          alreadyInformedIds,
        });

        await db.email.create({
          data: {
            userId,
            emailSource: "OUTLOOK",
            outlookMessageId: msg.id,
            outlookThreadId: msg.conversationId,
            subject: msg.subject,
            fromAddress: msg.from,
            fromName: msg.fromName,
            toAddresses: msg.to,
            snippet: msg.snippet,
            receivedAt: msg.receivedAt,
            internalDate: BigInt(msg.receivedAt.getTime()),
            importanceScore: classified.importance_score,
            category: (CATEGORY_MAP[classified.category] ?? "INFORMATIONAL") as any,
            whyImportant: classified.why_important,
            shortSummary: classified.short_summary,
            actionNeeded: classified.action_needed,
            dueDate: classified.due_date,
            confidence: classified.confidence,
            alreadyInformed: classified.already_informed_suggestion,
            classifiedAt: new Date(),
            labels: [],
          },
        });
        succeeded++;
      } catch {
        failed++;
      }
    }

    if (deltaLink) {
      await db.syncCursor.upsert({
        where: { userId_provider: { userId, provider: "OUTLOOK" } },
        update: { cursor: deltaLink },
        create: { userId, provider: "OUTLOOK", cursor: deltaLink },
      });
    }

    results.outlook = { synced: messages.length, succeeded, failed };
  } catch (err: any) {
    console.error("[sync/outlook]", err);
    results.outlook = { error: err.message };
  }

  // ── Microsoft Calendar sync ───────────────────────────────────────────────
  try {
    const calCursor = await db.syncCursor.findUnique({
      where: { userId_provider: { userId, provider: "MICROSOFT_CALENDAR" } },
    });

    const { events, deltaLink } = await syncMicrosoftCalendarIncremental(
      userId,
      calCursor?.cursor ?? undefined
    );

    for (const event of events) {
      const data = microsoftEventToCalendarEvent(userId, event);
      await db.calendarEvent.upsert({
        where: { outlookEventId: event.id },
        update: { ...data, updatedAt: new Date() },
        create: data as any,
      });
    }

    if (deltaLink) {
      await db.syncCursor.upsert({
        where: { userId_provider: { userId, provider: "MICROSOFT_CALENDAR" } },
        update: { cursor: deltaLink },
        create: { userId, provider: "MICROSOFT_CALENDAR", cursor: deltaLink },
      });
    }

    results.calendar = { synced: events.length };
  } catch (err: any) {
    console.error("[sync/ms-calendar]", err);
    results.calendar = { error: err.message };
  }

  // ── Teams messages sync ───────────────────────────────────────────────────
  try {
    const teamsMessages = await syncTeamsMessages(userId);
    let teamsNew = 0;

    for (const msg of teamsMessages) {
      const existing = await db.teamsMessage.findUnique({
        where: { teamsMessageId: msg.id },
      });
      if (existing) continue;

      await db.teamsMessage.create({
        data: {
          userId,
          teamsMessageId: msg.id,
          chatId: msg.chatId,
          chatName: msg.chatName,
          chatType: msg.chatType,
          senderName: msg.senderName,
          senderAddress: msg.senderAddress,
          content: msg.content,
          receivedAt: msg.receivedAt,
        },
      });
      teamsNew++;
    }

    results.teams = { synced: teamsMessages.length, new: teamsNew };
  } catch (err: any) {
    console.error("[sync/teams]", err);
    results.teams = { error: err.message };
  }

  // ── Smart alerts ──────────────────────────────────────────────────────────
  try {
    await generateSmartAlerts(userId);
  } catch { /* non-blocking */ }

  // ── Audit log ─────────────────────────────────────────────────────────────
  await db.auditLog.create({
    data: {
      userId,
      action: "SYNC_OUTLOOK",
      detail: `Outlook: ${results.outlook?.succeeded ?? 0} emails, Calendar: ${results.calendar?.synced ?? 0} events, Teams: ${results.teams?.new ?? 0} messages`,
      meta: results,
    },
  });

  return NextResponse.json({ success: true, data: results });
}
