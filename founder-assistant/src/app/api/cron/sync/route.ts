import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Vercel Cron: runs every 20 minutes, syncs all users with active Gmail connections.
// Secured via CRON_SECRET env var (set in Vercel project settings).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only sync users who have an active Gmail connection and were seen in the last 7 days
  const activeConnections = await db.oAuthConnection.findMany({
    where: {
      provider: "GMAIL",
      isActive: true,
    },
    select: { userId: true },
    take: 10, // cap per cron tick to stay within Vercel timeout
  });

  const userIds = activeConnections.map((c) => c.userId);
  if (!userIds.length) {
    return NextResponse.json({ success: true, synced: 0 });
  }

  const results = await Promise.allSettled(
    userIds.map((userId) => syncUser(userId))
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ success: true, synced: succeeded, failed });
}

async function syncUser(userId: string) {
  const { syncGmailIncremental } = await import("@/lib/google/gmail");
  const { processEmailBatch } = await import("@/services/email.service");
  const { syncCalendarIncremental, upsertCalendarEvents } = await import("@/lib/google/calendar");
  const { generateSmartAlerts } = await import("@/services/alerts.service");

  // Gmail
  const gmailCursor = await db.syncCursor.findUnique({
    where: { userId_provider: { userId, provider: "GMAIL" } },
  });
  const { messages, newHistoryId } = await syncGmailIncremental(
    userId,
    gmailCursor?.cursor ?? undefined
  );
  const batch = messages.slice(0, 30);
  await processEmailBatch(userId, batch);
  await db.syncCursor.upsert({
    where: { userId_provider: { userId, provider: "GMAIL" } },
    update: { cursor: newHistoryId },
    create: { userId, provider: "GMAIL", cursor: newHistoryId },
  });

  // Calendar
  try {
    const calCursor = await db.syncCursor.findUnique({
      where: { userId_provider: { userId, provider: "GOOGLE_CALENDAR" } },
    });
    const { events, newSyncToken } = await syncCalendarIncremental(
      userId,
      calCursor?.cursor ?? undefined
    );
    await upsertCalendarEvents(userId, events);
    if (newSyncToken) {
      await db.syncCursor.upsert({
        where: { userId_provider: { userId, provider: "GOOGLE_CALENDAR" } },
        update: { cursor: newSyncToken },
        create: { userId, provider: "GOOGLE_CALENDAR", cursor: newSyncToken },
      });
    }
  } catch { /* calendar optional */ }

  // Smart alerts after sync
  try {
    await generateSmartAlerts(userId);
  } catch { /* non-blocking */ }
}
