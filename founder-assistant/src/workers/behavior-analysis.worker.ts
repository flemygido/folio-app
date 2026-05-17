import { Worker, type Job } from "bullmq";
import { redis } from "@/lib/redis";
import type { ConnectionOptions } from "bullmq";
const conn = redis as unknown as ConnectionOptions;
import { analyzeEmailBehavior } from "@/services/behavior-analysis.service";
import { processNewEmailsForIntelligence } from "@/services/calendar-intelligence.service";

interface BehaviorJob {
  userId: string;
}

export function createBehaviorAnalysisWorker() {
  return new Worker<BehaviorJob>(
    "behavior-analysis",
    async (job: Job<BehaviorJob>) => {
      const { userId } = job.data;

      await job.log(`Running behavior analysis for ${userId}`);
      const result = await analyzeEmailBehavior(userId);
      await job.log(`Analysis done: ${result.senders} senders, ${result.emailsAnalyzed} emails`);

      await job.log("Running calendar intelligence...");
      await processNewEmailsForIntelligence(userId);
      await job.log("Calendar intelligence complete");
    },
    { connection: conn, concurrency: 2 }
  );
}
