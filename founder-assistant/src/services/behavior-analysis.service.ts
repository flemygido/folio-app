/**
 * Email Behavior Analysis Service
 *
 * Learns what the user cares about by analyzing:
 * - Which emails they actually read (UNREAD label absent = was opened)
 * - Which senders they reply to (and how fast)
 * - Writing style in sent emails (tone, formality, length)
 * - Topics that get engagement vs. ignored
 *
 * Runs weekly per user. Output feeds into:
 * - EmailBehaviorStat (per-sender importance signal)
 * - MemoryFact (VIP contacts, suppression candidates)
 * - Email classification scoring (boost/reduce scores)
 */

import { db } from "@/lib/db";
import { upsertMemoryFact, addSuppression } from "./memory.service";

// ─── MAIN ANALYSIS ───────────────────────────────────────────────────────────

export async function analyzeEmailBehavior(userId: string) {
  const startedAt = Date.now();
  const since = new Date(Date.now() - 90 * 86400_000); // 90-day window

  // 1. Get all emails in window
  const emails = await db.email.findMany({
    where: { userId, receivedAt: { gte: since }, isDeleted: false },
    select: {
      id: true,
      gmailMessageId: true,
      gmailThreadId: true,
      fromAddress: true,
      fromName: true,
      labels: true,
      receivedAt: true,
      importanceScore: true,
      category: true,
    },
  });

  // 2. Get all sent emails (to find replies)
  const sentEmails = await db.email.findMany({
    where: {
      userId,
      labels: { has: "SENT" },
      receivedAt: { gte: since },
    },
    select: {
      gmailThreadId: true,
      receivedAt: true,
      toAddresses: true,
    },
  });

  // Build a set of thread IDs where user replied
  const repliedThreads = new Map<string, Date>();
  for (const sent of sentEmails) {
    if (!sent.gmailThreadId) continue;
    const existing = repliedThreads.get(sent.gmailThreadId);
    if (!existing || sent.receivedAt < existing) {
      repliedThreads.set(sent.gmailThreadId, sent.receivedAt);
    }
  }

  // 3. Group received emails by sender
  const senderMap = new Map<
    string,
    {
      name: string | null;
      emails: Array<{ threadId: string | null; receivedAt: Date; wasRead: boolean }>;
    }
  >();

  for (const email of emails) {
    if (email.labels.includes("SENT")) continue; // skip sent

    const wasRead = !email.labels.includes("UNREAD");
    const existing = senderMap.get(email.fromAddress) ?? { name: email.fromName, emails: [] };
    existing.emails.push({
      threadId: email.gmailThreadId,
      receivedAt: email.receivedAt,
      wasRead,
    });
    senderMap.set(email.fromAddress, existing);
  }

  // 4. Compute stats per sender
  const upsertOps: Promise<any>[] = [];

  for (const [senderAddress, data] of senderMap.entries()) {
    const totalReceived = data.emails.length;
    const totalRead = data.emails.filter((e) => e.wasRead).length;

    // Count replies in threads from this sender
    let totalReplied = 0;
    let totalReplyMinutes = 0;
    let repliedCount = 0;

    for (const e of data.emails) {
      const replyTime = e.threadId ? repliedThreads.get(e.threadId) : undefined;
      if (replyTime) {
        totalReplied++;
        const latency = (replyTime.getTime() - e.receivedAt.getTime()) / 60000;
        if (latency > 0 && latency < 10080) { // ignore >1 week as outlier
          totalReplyMinutes += latency;
          repliedCount++;
        }
      }
    }

    const avgResponseMinutes = repliedCount > 0 ? totalReplyMinutes / repliedCount : null;
    const readRate = totalReceived > 0 ? totalRead / totalReceived : 0;
    const replyRate = totalReceived > 0 ? totalReplied / totalReceived : 0;

    // ─── Importance Signal Algorithm ─────────────────────────────────────────
    let signal = 0.4; // base

    // High read rate = user opens this sender's emails
    if (readRate > 0.8) signal += 0.2;
    else if (readRate > 0.5) signal += 0.1;
    else if (readRate < 0.1 && totalReceived > 5) signal -= 0.2;

    // High reply rate = user engages with this sender
    if (replyRate > 0.5) signal += 0.2;
    else if (replyRate > 0.2) signal += 0.1;

    // Fast replies = sender is high priority
    if (avgResponseMinutes !== null) {
      if (avgResponseMinutes < 60) signal += 0.15;
      else if (avgResponseMinutes < 360) signal += 0.05;
    }

    // Volume with low engagement = likely noise
    if (totalReceived > 20 && readRate < 0.05) signal = Math.min(signal, 0.2);

    signal = Math.max(0, Math.min(1, signal));

    const lastEmail = data.emails.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())[0];

    upsertOps.push(
      db.emailBehaviorStat.upsert({
        where: { userId_senderAddress: { userId, senderAddress } },
        update: {
          senderName: data.name,
          totalReceived,
          totalRead,
          totalReplied,
          avgResponseMinutes,
          lastEmailAt: lastEmail?.receivedAt,
          importanceSignal: signal,
        },
        create: {
          userId,
          senderAddress,
          senderName: data.name,
          totalReceived,
          totalRead,
          totalReplied,
          avgResponseMinutes,
          lastEmailAt: lastEmail?.receivedAt,
          importanceSignal: signal,
        },
      })
    );

    // Learn VIP contacts (signal > 0.75)
    if (signal > 0.75 && totalReceived >= 3) {
      upsertOps.push(
        upsertMemoryFact({
          userId,
          type: "CONTACT",
          key: "vip_sender",
          value: `${data.name ?? senderAddress} (${senderAddress})`,
          confidence: Math.min(0.95, signal),
          source: "email_behavior_analysis",
        })
      );
    }

    // Learn suppression candidates (signal < 0.1, high volume)
    if (signal < 0.1 && totalReceived > 10 && replyRate === 0) {
      upsertOps.push(
        addSuppression(userId, senderAddress, "Auto: high volume, never read or replied")
      );
    }
  }

  await Promise.allSettled(upsertOps);

  // 5. Analyze writing style from sent emails (personality inference)
  const sentSample = sentEmails.slice(0, 30);
  if (sentSample.length > 0) {
    await inferWritingStyle(userId, sentSample.map((s) => s.gmailThreadId).filter((id): id is string => id !== null));
  }

  const duration = Date.now() - startedAt;
  await db.auditLog.create({
    data: {
      userId,
      action: "BEHAVIOR_ANALYSIS",
      detail: `Analyzed ${senderMap.size} senders from ${emails.length} emails`,
      meta: { senders: senderMap.size, emails: emails.length },
      durationMs: duration,
    },
  });

  return { senders: senderMap.size, emailsAnalyzed: emails.length };
}

// ─── WRITING STYLE INFERENCE ─────────────────────────────────────────────────
// Lightweight: look at sent email patterns to infer formality preferences

async function inferWritingStyle(userId: string, threadIds: string[]) {
  const sentEmails = await db.email.findMany({
    where: { userId, gmailThreadId: { in: threadIds }, labels: { has: "SENT" } },
    select: { bodyText: true, subject: true },
    take: 20,
  });

  const avgLength =
    sentEmails.reduce((sum, e) => sum + (e.bodyText?.length ?? 0), 0) /
    Math.max(sentEmails.length, 1);

  const formalKeywords = ["regards", "sincerely", "dear", "please find", "i hope this"];
  const casualKeywords = ["hey", "thanks!", "cheers", "sounds good", "let's"];

  let formalScore = 0;
  let casualScore = 0;

  for (const e of sentEmails) {
    const lower = (e.bodyText ?? "").toLowerCase();
    formalKeywords.forEach((k) => { if (lower.includes(k)) formalScore++; });
    casualKeywords.forEach((k) => { if (lower.includes(k)) casualScore++; });
  }

  const style =
    formalScore > casualScore * 1.5
      ? "formal"
      : casualScore > formalScore * 1.5
      ? "casual"
      : "professional";

  await upsertMemoryFact({
    userId,
    type: "PREFERENCE",
    key: "communication_style",
    value: `User writes ${style} emails, avg ${Math.round(avgLength)} chars per message`,
    confidence: 0.75,
    source: "email_behavior_analysis",
  });
}

// ─── IMPORTANCE BOOST ────────────────────────────────────────────────────────
// Called during email classification to boost/reduce score using behavior data

export async function getBehaviorBoost(userId: string, senderAddress: string): Promise<number> {
  const stat = await db.emailBehaviorStat.findUnique({
    where: { userId_senderAddress: { userId, senderAddress } },
    select: { importanceSignal: true },
  });

  if (!stat) return 0; // no data yet

  // Convert 0–1 signal into a score modifier: -15 to +15
  const boost = Math.round((stat.importanceSignal - 0.5) * 30);
  return boost;
}
