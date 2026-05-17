import { Worker, type Job } from "bullmq";
import { redis } from "@/lib/redis";
import type { ConnectionOptions } from "bullmq";
const conn = redis as unknown as ConnectionOptions;
import { generateDailyBriefing } from "@/services/briefing.service";
import type { BriefingJob } from "./queues";

export function createBriefingWorker() {
  return new Worker<BriefingJob>(
    "generate-briefing",
    async (job: Job<BriefingJob>) => {
      const { userId, date } = job.data;
      await job.log(`Generating briefing for ${userId} on ${date}`);
      const briefing = await generateDailyBriefing(userId, date);
      await job.log(`Briefing ${briefing.id} ready. Signal score: ${briefing.signalScore}`);
    },
    { connection: conn, concurrency: 3 }
  );
}
