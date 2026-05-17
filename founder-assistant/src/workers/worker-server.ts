/**
 * Worker server entry point.
 * Run separately from Next.js: `node dist/workers/worker-server.js`
 * On Railway: set start command to this file.
 */

import { createGmailSyncWorker } from "./gmail-sync.worker";
import { createCalendarSyncWorker } from "./calendar-sync.worker";
import { createBriefingWorker } from "./briefing.worker";
import { createBehaviorAnalysisWorker } from "./behavior-analysis.worker";
import { gmailSyncQueue, briefingQueue, enqueueBehaviorAnalysis } from "./queues";
import { db } from "@/lib/db";
import { format } from "date-fns";

const workers = [
  createGmailSyncWorker(),
  createCalendarSyncWorker(),
  createBriefingWorker(),
  createBehaviorAnalysisWorker(),
];

for (const w of workers) {
  w.on("failed", (job, err) => {
    console.error(`[Worker] ${w.name} job ${job?.id} failed:`, err.message);
  });
  w.on("completed", (job) => {
    console.log(`[Worker] ${w.name} job ${job.id} completed`);
  });
}

// ─── DAILY CRON: 7 AM BRIEFINGS ──────────────────────────────────────────────
// On Railway you can use their cron, or use this simple interval approach.

async function scheduleDailyBriefings() {
  const users = await db.user.findMany({ select: { id: true, briefingTime: true, timezone: true } });

  for (const user of users) {
    const today = format(new Date(), "yyyy-MM-dd");
    const alreadyQueued = await briefingQueue.getJob(`brief-${user.id}-${today}`);
    if (!alreadyQueued) {
      await briefingQueue.add("briefing", { userId: user.id, date: today });
      await gmailSyncQueue.add("sync", { userId: user.id });
      console.log(`[Cron] Queued briefing + sync for user ${user.id}`);
    }
  }
}

// Check every 5 minutes if any user needs a morning briefing
setInterval(scheduleDailyBriefings, 5 * 60_000);
scheduleDailyBriefings(); // run on startup

console.log("[Workers] All workers started.");

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[Workers] Shutting down...");
  await Promise.all(workers.map((w) => w.close()));
  await db.$disconnect();
  process.exit(0);
});
