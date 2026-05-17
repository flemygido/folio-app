import { NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { classifyEmail } from "@/lib/openai";
import { buildMemoryContext } from "@/services/memory.service";
import { generateSmartAlerts } from "@/services/alerts.service";

function extractBodyFromPayload(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf8");
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBodyFromPayload(part);
      if (text) return text;
    }
  }
  return "";
}

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

  // ── Gmail sync ────────────────────────────────────────────────────────────
  try {
    const { syncGmailIncremental } = await import("@/lib/google/gmail");
    const { processEmailBatch } = await import("@/services/email.service");

    const cursor = await db.syncCursor.findUnique({
      where: { userId_provider: { userId, provider: "GMAIL" } },
    });

    const { messages, newHistoryId } = await syncGmailIncremental(userId, cursor?.cursor ?? undefined);
    const batch = messages.slice(0, 150);
    const { succeeded, failed } = await processEmailBatch(userId, batch);

    await db.syncCursor.upsert({
      where: { userId_provider: { userId, provider: "GMAIL" } },
      update: { cursor: newHistoryId },
      create: { userId, provider: "GMAIL", cursor: newHistoryId },
    });

    results.gmail = { synced: batch.length, succeeded, failed };

    // Re-classify emails wrongly auto-pruned due to CATEGORY_UPDATES label
    // (account alerts, payment notifications, merchant setup emails)
    try {
      const { getGmailClient } = await import("@/lib/google/gmail");
      const wronglySuppressed = await db.email.findMany({
        where: {
          userId,
          importanceScore: { lte: 10 },
          category: "PROMO",
          classifiedAt: { not: null },
          receivedAt: { gte: new Date(Date.now() - 10 * 86400_000) },
        },
        take: 20,
        select: { id: true, gmailMessageId: true, subject: true, fromAddress: true, fromName: true, snippet: true },
      });

      if (wronglySuppressed.length > 0) {
        const gmailAuth = await getGmailClient(userId);
        const gmailClient = google.gmail({ version: "v1", auth: gmailAuth });
        const memCtx = await buildMemoryContext(userId);

        await Promise.allSettled(wronglySuppressed.map(async (email) => {
          try {
            const raw = await gmailClient.users.messages.get({
              userId: "me",
              id: email.gmailMessageId,
              format: "full",
            });
            const labelIds: string[] = (raw.data as any).labelIds ?? [];
            // Skip confirmed spam — let AI re-classify everything else
            if (labelIds.includes("SPAM")) return;

            const bodyText = extractBodyFromPayload((raw.data as any).payload);
            const result = await classifyEmail({
              subject: email.subject,
              from: email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress,
              snippet: email.snippet ?? "",
              bodyText,
              memoryContext: memCtx,
              alreadyInformedIds: [],
            });

            await db.email.update({
              where: { id: email.id },
              data: {
                importanceScore: result.importance_score,
                category: (CATEGORY_MAP[result.category] ?? "INFORMATIONAL") as any,
                whyImportant: result.why_important,
                shortSummary: result.short_summary,
                actionNeeded: result.action_needed,
                dueDate: result.due_date,
                confidence: result.confidence,
                alreadyInformed: result.already_informed_suggestion,
                classifiedAt: new Date(),
                bodyText: null,
              },
            });
          } catch { /* skip individual failures */ }
        }));

        results.reclassified = wronglySuppressed.length;
      }
    } catch { /* reclassify is best-effort, never blocks main sync */ }
  } catch (err: any) {
    console.error("[sync/gmail]", err);
    results.gmail = { error: err.message };
  }

  // ── Calendar sync ─────────────────────────────────────────────────────────
  try {
    const { syncCalendarIncremental, upsertCalendarEvents } = await import("@/lib/google/calendar");

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

    results.calendar = { synced: events.length };
  } catch (err: any) {
    console.error("[sync/calendar]", err);
    results.calendar = { error: err.message };
  }

  // ── Smart alerts ──────────────────────────────────────────────────────────
  try {
    await generateSmartAlerts(userId);
  } catch { /* non-blocking */ }

  // ── Audit log ─────────────────────────────────────────────────────────────
  await db.auditLog.create({
    data: {
      userId,
      action: "SYNC_GMAIL",
      detail: `Synced: Gmail ${results.gmail?.synced ?? 0} emails, Calendar ${results.calendar?.synced ?? 0} events, reclassified ${results.reclassified ?? 0}`,
      meta: results,
    },
  });

  return NextResponse.json({ success: true, data: results });
}
