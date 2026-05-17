import { db } from "@/lib/db";
import { classifyEmail } from "@/lib/openai";
import { buildMemoryContext, getAlreadyInformedIds } from "./memory.service";
import { purgeEmailBody } from "./privacy.service";
import { isLikelyCruft } from "@/lib/google/gmail";
import type { GmailMessage } from "@/types";
import type { EmailCategory } from "@prisma/client";

const CATEGORY_MAP: Record<string, EmailCategory> = {
  urgent: "URGENT",
  action_required: "ACTION_REQUIRED",
  watch: "WATCH",
  informational: "INFORMATIONAL",
  newsletter: "NEWSLETTER",
  promo: "PROMO",
  ignore: "IGNORE",
};

// ─── PROCESS BATCH ───────────────────────────────────────────────────────────
// Called by classify worker for each batch of raw Gmail messages

export async function processEmailBatch(userId: string, messages: GmailMessage[]) {
  const [memoryContext, alreadyInformed] = await Promise.all([
    buildMemoryContext(userId),
    getAlreadyInformedIds(userId),
  ]);

  const results = await Promise.allSettled(
    messages.map((msg) => processOneEmail(userId, msg, memoryContext, alreadyInformed))
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return { succeeded, failed };
}

async function processOneEmail(
  userId: string,
  msg: GmailMessage,
  memoryContext: string,
  alreadyInformedIds: string[]
) {
  // Check for existing to avoid re-processing
  const existing = await db.email.findUnique({ where: { gmailMessageId: msg.id } });
  if (existing?.classifiedAt) return; // already classified

  // Fast-path: skip obvious cruft without calling OpenAI
  const cruft = isLikelyCruft(msg);

  let classification = null;
  if (!cruft) {
    classification = await classifyEmail({
      subject: msg.subject,
      from: `${msg.fromName ?? ""} <${msg.from}>`,
      snippet: msg.snippet,
      bodyText: msg.bodyText,
      memoryContext,
      alreadyInformedIds,
    });
  }

  const score = cruft ? 10 : (classification?.importance_score ?? 10);
  const category = cruft ? "PROMO" : CATEGORY_MAP[classification?.category ?? "informational"] ?? "INFORMATIONAL";

  let emailId: string;

  if (existing) {
    await db.email.update({
      where: { id: existing.id },
      data: {
        importanceScore: score,
        category,
        whyImportant: classification?.why_important ?? null,
        shortSummary: classification?.short_summary ?? null,
        actionNeeded: classification?.action_needed ?? null,
        dueDate: classification?.due_date ?? null,
        confidence: classification?.confidence ?? (cruft ? 1.0 : null),
        classifiedAt: new Date(),
        bodyText: null, // purge immediately after classification
      },
    });
    emailId = existing.id;
  } else {
    // Store body briefly so task extraction can read it, then purge
    const created = await db.email.create({
      data: {
        userId,
        gmailMessageId: msg.id,
        gmailThreadId: msg.threadId,
        subject: msg.subject,
        fromAddress: msg.from,
        fromName: msg.fromName,
        toAddresses: msg.to,
        snippet: msg.snippet.slice(0, 120),
        bodyText: msg.bodyText.slice(0, 2000), // temporary — purged below
        receivedAt: msg.receivedAt,
        internalDate: msg.internalDate,
        labels: msg.labels,
        threadSize: msg.threadSize,
        importanceScore: score,
        category,
        whyImportant: classification?.why_important ?? null,
        shortSummary: classification?.short_summary ?? null,
        actionNeeded: classification?.action_needed ?? null,
        dueDate: classification?.due_date ?? null,
        confidence: classification?.confidence ?? null,
        classifiedAt: new Date(),
      },
    });
    emailId = created.id;
    // Purge raw body immediately — we only keep AI-generated metadata
    await purgeEmailBody(emailId);
  }
}

// ─── QUERY HELPERS ────────────────────────────────────────────────────────────

export async function getImportantEmails(userId: string, daysBack = 10, limit = 20) {
  const since = new Date(Date.now() - daysBack * 86400_000);
  return db.email.findMany({
    where: {
      userId,
      receivedAt: { gte: since },
      importanceScore: { gte: 60 },
      category: { notIn: ["NEWSLETTER", "PROMO", "IGNORE"] },
      isDeleted: false,
    },
    orderBy: [{ importanceScore: "desc" }, { receivedAt: "desc" }],
    take: limit,
  });
}

export async function getNewImportantEmails(userId: string) {
  return db.email.findMany({
    where: {
      userId,
      importanceScore: { gte: 60 },
      alreadyInformed: false,
      category: { notIn: ["NEWSLETTER", "PROMO", "IGNORE"] },
      isDeleted: false,
    },
    orderBy: [{ importanceScore: "desc" }, { receivedAt: "desc" }],
  });
}
