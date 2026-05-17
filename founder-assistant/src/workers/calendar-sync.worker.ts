import { Worker, type Job } from "bullmq";
import { redis } from "@/lib/redis";
import type { ConnectionOptions } from "bullmq";
const conn = redis as unknown as ConnectionOptions;
import { db } from "@/lib/db";
import { syncCalendarIncremental, upsertCalendarEvents } from "@/lib/google/calendar";
import type { CalendarSyncJob } from "./queues";

export function createCalendarSyncWorker() {
  return new Worker<CalendarSyncJob>(
    "calendar-sync",
    async (job: Job<CalendarSyncJob>) => {
      const { userId } = job.data;

      const cursor = await db.syncCursor.findUnique({
        where: { userId_provider: { userId, provider: "GOOGLE_CALENDAR" } },
      });

      const { events, newSyncToken } = await syncCalendarIncremental(userId, cursor?.cursor);

      await upsertCalendarEvents(userId, events);

      if (newSyncToken) {
        await db.syncCursor.upsert({
          where: { userId_provider: { userId, provider: "GOOGLE_CALENDAR" } },
          update: { cursor: newSyncToken },
          create: { userId, provider: "GOOGLE_CALENDAR", cursor: newSyncToken },
        });
      }

      await db.auditLog.create({
        data: {
          userId,
          action: "SYNC_CALENDAR",
          detail: `Synced ${events.length} calendar events`,
          meta: { count: events.length },
        },
      });
    },
    { connection: conn, concurrency: 2 }
  );
}
