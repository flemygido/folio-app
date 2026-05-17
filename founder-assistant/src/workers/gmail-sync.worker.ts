import { Worker, type Job } from "bullmq";
import { redis } from "@/lib/redis";
import type { ConnectionOptions } from "bullmq";
const conn = redis as unknown as ConnectionOptions;
import { db } from "@/lib/db";
import { syncGmailIncremental } from "@/lib/google/gmail";
import { processEmailBatch } from "@/services/email.service";
import { enqueueCalendarSync, enqueueDriveSync } from "./queues";
import type { GmailSyncJob } from "./queues";

export function createGmailSyncWorker() {
  return new Worker<GmailSyncJob>(
    "gmail-sync",
    async (job: Job<GmailSyncJob>) => {
      const { userId } = job.data;
      const startedAt = Date.now();

      await job.log(`Starting Gmail sync for user ${userId}`);

      // Get last cursor
      const cursor = await db.syncCursor.findUnique({
        where: { userId_provider: { userId, provider: "GMAIL" } },
      });

      const { messages, newHistoryId } = await syncGmailIncremental(
        userId,
        cursor?.cursor
      );

      await job.log(`Pulled ${messages.length} messages`);

      // Upsert raw messages to DB
      let persisted = 0;
      for (const msg of messages) {
        try {
          await db.email.upsert({
            where: { gmailMessageId: msg.id },
            update: { threadSize: msg.threadSize, labels: msg.labels },
            create: {
              userId,
              gmailMessageId: msg.id,
              gmailThreadId: msg.threadId,
              subject: msg.subject,
              fromAddress: msg.from,
              fromName: msg.fromName,
              toAddresses: msg.to,
              snippet: msg.snippet,
              bodyText: msg.bodyText.slice(0, 2000),
              receivedAt: msg.receivedAt,
              internalDate: msg.internalDate,
              labels: msg.labels,
              threadSize: msg.threadSize,
            },
          });
          persisted++;
        } catch {
          // skip duplicates or transient errors
        }
      }

      // Update cursor
      await db.syncCursor.upsert({
        where: { userId_provider: { userId, provider: "GMAIL" } },
        update: { cursor: newHistoryId },
        create: { userId, provider: "GMAIL", cursor: newHistoryId },
      });

      // Classify new emails (unclassified ones)
      const unclassified = await db.email.findMany({
        where: { userId, classifiedAt: null },
        select: { id: true },
        take: 200,
      });

      if (unclassified.length > 0) {
        const rawMessages = await db.email.findMany({
          where: { id: { in: unclassified.map((e) => e.id) } },
        });

        // Convert to GmailMessage format for processing
        const gmailMessages = rawMessages.map((e) => ({
          id: e.gmailMessageId ?? "",
          threadId: e.gmailThreadId ?? "",
          subject: e.subject,
          from: e.fromAddress,
          fromName: e.fromName,
          to: e.toAddresses,
          snippet: e.snippet ?? "",
          bodyText: e.bodyText ?? "",
          receivedAt: e.receivedAt,
          internalDate: e.internalDate,
          labels: e.labels,
          threadSize: e.threadSize,
        }));

        const { succeeded, failed } = await processEmailBatch(userId, gmailMessages);
        await job.log(`Classified ${succeeded} emails (${failed} failed)`);
      }

      const duration = Date.now() - startedAt;

      await db.auditLog.create({
        data: {
          userId,
          action: "SYNC_GMAIL",
          detail: `Synced ${persisted} messages`,
          meta: { persisted, unclassified: unclassified.length },
          durationMs: duration,
        },
      });

      // Trigger downstream syncs
      await Promise.all([enqueueCalendarSync(userId), enqueueDriveSync(userId)]);
    },
    {
      connection: conn,
      concurrency: 2,
    }
  );
}
