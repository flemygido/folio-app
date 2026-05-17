import { db } from "@/lib/db";
import type { MemoryType } from "@prisma/client";

// ─── CONTEXT BUILDER ─────────────────────────────────────────────────────────
// Returns a compact string injected into AI prompts

export async function buildMemoryContext(userId: string): Promise<string> {
  const [facts, suppressions] = await Promise.all([
    db.memoryFact.findMany({
      where: { userId, isActive: true },
      orderBy: { confidence: "desc" },
      take: 30,
    }),
    db.memorySuppression.findMany({
      where: { userId, isActive: true },
    }),
  ]);

  const lines: string[] = [];

  const byType = new Map<string, typeof facts>();
  for (const f of facts) {
    const list = byType.get(f.type) ?? [];
    list.push(f);
    byType.set(f.type, list);
  }

  if (byType.has("CONTACT")) {
    lines.push("VIP contacts: " + byType.get("CONTACT")!.map((f) => f.value).join("; "));
  }
  if (byType.has("PROJECT")) {
    lines.push("Active projects: " + byType.get("PROJECT")!.map((f) => f.value).join("; "));
  }
  if (byType.has("PRIORITY")) {
    lines.push("Current priorities: " + byType.get("PRIORITY")!.map((f) => f.value).join("; "));
  }
  if (byType.has("PREFERENCE")) {
    lines.push("User preferences: " + byType.get("PREFERENCE")!.map((f) => f.value).join("; "));
  }
  if (suppressions.length > 0) {
    lines.push("Suppress/ignore: " + suppressions.map((s) => s.pattern).join("; "));
  }

  return lines.join("\n") || "No memory context yet.";
}

// ─── UPSERT FACT ─────────────────────────────────────────────────────────────

export async function upsertMemoryFact(params: {
  userId: string;
  type: MemoryType;
  key: string;
  value: string;
  confidence?: number;
  source?: string;
  sourceRef?: string;
}) {
  const existing = await db.memoryFact.findFirst({
    where: { userId: params.userId, type: params.type, key: params.key },
  });

  if (existing) {
    // Increase confidence if same fact confirmed again
    const newConfidence = Math.min(1.0, (existing.confidence + (params.confidence ?? 0.8)) / 2 + 0.05);
    return db.memoryFact.update({
      where: { id: existing.id },
      data: {
        value: params.value,
        confidence: newConfidence,
        source: params.source ?? existing.source,
        sourceRef: params.sourceRef ?? existing.sourceRef,
      },
    });
  }

  return db.memoryFact.create({
    data: {
      userId: params.userId,
      type: params.type,
      key: params.key,
      value: params.value,
      confidence: params.confidence ?? 0.8,
      source: params.source,
      sourceRef: params.sourceRef,
    },
  });
}

// ─── ADD SUPPRESSION ─────────────────────────────────────────────────────────

export async function addSuppression(userId: string, pattern: string, reason?: string) {
  return db.memorySuppression.upsert({
    where: { userId_pattern: { userId, pattern } },
    update: { reason, isActive: true },
    create: { userId, pattern, reason },
  });
}

// ─── LEARN FROM FEEDBACK ─────────────────────────────────────────────────────
// Called after user marks an email with feedback

export async function learnFromFeedback(params: {
  userId: string;
  emailId: string;
  feedbackType: "important" | "ignore" | "seen" | "later" | "not_relevant";
}) {
  const email = await db.email.findUnique({ where: { id: params.emailId } });
  if (!email) return;

  if (params.feedbackType === "ignore") {
    // Learn to suppress this sender
    await addSuppression(params.userId, email.fromAddress, "User marked as ignore");

    // Lower confidence on this email's category if was classified important
    if (email.importanceScore && email.importanceScore > 60) {
      await db.auditLog.create({
        data: {
          userId: params.userId,
          action: "UPDATE_MEMORY",
          detail: `Learned to suppress ${email.fromAddress} after user ignored`,
        },
      });
    }
  }

  if (params.feedbackType === "important") {
    // Mark this sender as VIP
    await upsertMemoryFact({
      userId: params.userId,
      type: "CONTACT",
      key: "vip_sender",
      value: `${email.fromName ?? email.fromAddress} (${email.fromAddress})`,
      confidence: 0.85,
      source: "user_feedback",
      sourceRef: email.id,
    });
  }
}

// ─── ALREADY INFORMED CHECK ──────────────────────────────────────────────────

export async function getAlreadyInformedIds(userId: string): Promise<string[]> {
  const informed = await db.email.findMany({
    where: { userId, alreadyInformed: true },
    select: { gmailMessageId: true },
    orderBy: { informedAt: "desc" },
    take: 100,
  });
  return informed.map((e) => e.gmailMessageId).filter((id): id is string => id !== null);
}

export async function markAsInformed(userId: string, emailIds: string[], briefingId: string) {
  await db.email.updateMany({
    where: { userId, id: { in: emailIds } },
    data: { alreadyInformed: true, informedAt: new Date(), briefingId },
  });
}
