import { Queue } from "bullmq";
import { redis } from "@/lib/redis";
import type { ConnectionOptions } from "bullmq";

// redis is null when REDIS_URL is not configured — queues are never used in that case
const conn = redis as unknown as ConnectionOptions;

// ─── QUEUE DEFINITIONS ───────────────────────────────────────────────────────

export const gmailSyncQueue = new Queue("gmail-sync", {
  connection: conn,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});

export const calendarSyncQueue = new Queue("calendar-sync", {
  connection: conn,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});

export const driveSyncQueue = new Queue("drive-sync", {
  connection: conn,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});

export const classifyQueue = new Queue("classify-emails", {
  connection: conn,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 200,
    attempts: 2,
    backoff: { type: "fixed", delay: 3000 },
  },
});

export const behaviorQueue = new Queue("behavior-analysis", {
  connection: conn,
  defaultJobOptions: {
    removeOnComplete: 20,
    removeOnFail: 50,
    attempts: 2,
  },
});

export const briefingQueue = new Queue("generate-briefing", {
  connection: conn,
  defaultJobOptions: {
    removeOnComplete: 30,
    removeOnFail: 30,
    attempts: 2,
  },
});

// ─── JOB TYPES ───────────────────────────────────────────────────────────────

export interface GmailSyncJob {
  userId: string;
}

export interface CalendarSyncJob {
  userId: string;
}

export interface DriveSyncJob {
  userId: string;
}

export interface ClassifyJob {
  userId: string;
  messageIds: string[]; // internal DB email ids to classify
}

export interface BehaviorAnalysisJob {
  userId: string;
}

export interface BriefingJob {
  userId: string;
  date: string; // YYYY-MM-DD
}

// ─── ENQUEUE HELPERS ─────────────────────────────────────────────────────────

export async function enqueueGmailSync(userId: string) {
  return gmailSyncQueue.add("sync", { userId }, { jobId: `gmail-${userId}-${Date.now()}` });
}

export async function enqueueCalendarSync(userId: string) {
  return calendarSyncQueue.add("sync", { userId }, { jobId: `cal-${userId}-${Date.now()}` });
}

export async function enqueueDriveSync(userId: string) {
  return driveSyncQueue.add("sync", { userId }, { jobId: `drive-${userId}-${Date.now()}` });
}

export async function enqueueClassify(userId: string, messageIds: string[]) {
  return classifyQueue.add("classify", { userId, messageIds }, { jobId: `classify-${userId}-${Date.now()}` });
}

export async function enqueueBehaviorAnalysis(userId: string) {
  // Run weekly per user
  const jobId = `behavior-${userId}-${new Date().toISOString().slice(0, 10)}`;
  return behaviorQueue.add("analyze", { userId }, { jobId });
}

export async function enqueueBriefing(userId: string, date: string) {
  return briefingQueue.add(
    "briefing",
    { userId, date },
    { jobId: `brief-${userId}-${date}`, delay: 0 }
  );
}
