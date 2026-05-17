import { db } from "@/lib/db";
import type { AlertType, AlertUrgency } from "@prisma/client";

// ─── PATTERN RULES ───────────────────────────────────────────────────────────

interface AlertRule {
  type: AlertType;
  urgency: AlertUrgency;
  titleFn: (subject: string, sender: string) => string;
  bodyFn: (subject: string, sender: string, snippet: string) => string;
  match: (subject: string, snippet: string, sender: string) => boolean;
}

const RULES: AlertRule[] = [
  {
    type: "PAYMENT_RISK",
    urgency: "CRITICAL",
    match: (subject) =>
      /payment (failed|unsuccessful|declined|overdue|past due)|invoice (overdue|due)|subscription (expired|cancelled|failed)|card declined|transaction failed/i.test(subject),
    titleFn: (subject) => `Payment issue: ${subject.slice(0, 60)}`,
    bodyFn: (subject, sender, snippet) =>
      `${sender} sent a payment-related alert. ${snippet.slice(0, 120)}`,
  },
  {
    type: "VIP_MESSAGE",
    urgency: "HIGH",
    match: (subject, snippet, sender) =>
      /urgent|asap|action required|time.sensitive|critical|escalation/i.test(subject) &&
      !/noreply|no-reply|notifications?@|automated|donotreply/i.test(sender),
    titleFn: (subject, sender) => `Urgent from ${sender}: ${subject.slice(0, 50)}`,
    bodyFn: (subject, sender, snippet) =>
      `${sender} marked this as urgent. ${snippet.slice(0, 120)}`,
  },
  {
    type: "DEADLINE_RISK",
    urgency: "HIGH",
    match: (subject) =>
      /expires? (today|tomorrow|in \d+ hour|soon)|deadline (today|tomorrow)|due (today|tonight|by eod|by end of day)|last (chance|day)/i.test(subject),
    titleFn: (subject) => `Deadline alert: ${subject.slice(0, 60)}`,
    bodyFn: (subject, sender, snippet) =>
      `Something from ${sender} is expiring soon. ${snippet.slice(0, 120)}`,
  },
  {
    type: "DECISION_PENDING",
    urgency: "MEDIUM",
    match: (subject, snippet) =>
      /waiting (for|on) your (reply|response|approval|decision|confirmation)|please (confirm|approve|respond|review)|your (approval|sign-off) (is )?needed/i.test(
        subject + " " + snippet
      ),
    titleFn: (subject, sender) => `${sender} is waiting for your response`,
    bodyFn: (subject, sender, snippet) =>
      `"${subject}" — ${snippet.slice(0, 120)}`,
  },
  {
    type: "FOLLOW_UP_NEEDED",
    urgency: "MEDIUM",
    match: (subject, snippet) =>
      /following up|just checking in|any update|gentle reminder|as (discussed|mentioned|promised)|circling back/i.test(
        subject + " " + snippet
      ),
    titleFn: (subject, sender) => `Follow-up from ${sender}`,
    bodyFn: (subject, sender, snippet) =>
      `${sender} is following up on "${subject}". ${snippet.slice(0, 100)}`,
  },
];

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────────

export async function generateSmartAlerts(userId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h

  const newEmails = await db.email.findMany({
    where: {
      userId,
      receivedAt: { gte: since },
      importanceScore: { gte: 60 },
      isDeleted: false,
      category: { notIn: ["NEWSLETTER", "PROMO", "IGNORE"] },
    },
    select: {
      id: true,
      subject: true,
      fromAddress: true,
      fromName: true,
      snippet: true,
    },
  });

  if (!newEmails.length) return;

  // Collect existing source email IDs to avoid duplicate alerts
  const existingSourceIds = new Set(
    (
      await db.smartAlert.findMany({
        where: { userId, sourceEmailId: { not: null } },
        select: { sourceEmailId: true },
      })
    ).map((a) => a.sourceEmailId!)
  );

  const toCreate: Array<{
    userId: string;
    type: AlertType;
    urgency: AlertUrgency;
    title: string;
    body: string;
    sourceEmailId: string;
  }> = [];

  for (const email of newEmails) {
    if (existingSourceIds.has(email.id)) continue;

    const subject = email.subject ?? "";
    const snippet = email.snippet ?? "";
    const sender = email.fromName ?? email.fromAddress;

    for (const rule of RULES) {
      if (rule.match(subject, snippet, email.fromAddress)) {
        toCreate.push({
          userId,
          type: rule.type,
          urgency: rule.urgency,
          title: rule.titleFn(subject, sender),
          body: rule.bodyFn(subject, sender, snippet),
          sourceEmailId: email.id,
        });
        break; // one alert per email
      }
    }
  }

  if (toCreate.length) {
    await db.smartAlert.createMany({ data: toCreate, skipDuplicates: true });
  }
}
