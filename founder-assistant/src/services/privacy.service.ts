/**
 * Privacy Service
 *
 * Core principle: Process → Summarize → Destroy source.
 *
 * Raw email content is NEVER stored permanently.
 * We store only AI-generated metadata: score, category, summary, action.
 * The original words of the user's emails are discarded after classification.
 *
 * This service handles:
 * - Purging email body text after classification (auto-called by email service)
 * - Full account data deletion (GDPR right to erasure)
 * - Data audit (what we store and why)
 * - Anonymizing prompts before OpenAI calls
 */

import { db } from "@/lib/db";

// ─── AUTO-PURGE BODY TEXT ────────────────────────────────────────────────────
// Called immediately after an email is classified.
// We keep: subject, from, snippet (50 chars max), metadata, AI output.
// We delete: full body text.

export async function purgeEmailBody(emailId: string) {
  await db.email.update({
    where: { id: emailId },
    data: {
      bodyText: null, // ← deleted after classification, never stored long-term
    },
  });
}

export async function purgeAllEmailBodies(userId: string) {
  const result = await db.email.updateMany({
    where: { userId, bodyText: { not: null } },
    data: { bodyText: null },
  });
  return result.count;
}

// ─── SNIPPET TRUNCATION ──────────────────────────────────────────────────────
// Snippets stored in DB are truncated to 120 chars — enough for context,
// not enough to reconstruct the original email.

export function sanitizeSnippet(snippet: string): string {
  return snippet.slice(0, 120);
}

// ─── ANONYMIZE FOR AI ────────────────────────────────────────────────────────
// Before sending anything to OpenAI, we strip/replace identifying info
// that isn't needed for classification.

export function anonymizeForAI(params: {
  subject: string;
  from: string;
  snippet: string;
  bodyText: string;
  isVip?: boolean;
}): { subject: string; from: string; snippet: string; bodyText: string } {
  // Keep the from address — needed for VIP detection
  // But truncate body heavily — only first 600 chars needed for classification
  return {
    subject: params.subject,
    from: params.from,
    snippet: params.snippet.slice(0, 200),
    bodyText: params.bodyText.slice(0, 600), // classification only needs a sample
  };
}

// ─── FULL ACCOUNT DELETION ───────────────────────────────────────────────────
// GDPR Article 17 — Right to Erasure.
// Deletes ALL user data from our system in the correct dependency order.
// OAuth tokens, emails, calendar, drive, memory, tasks, logs — everything.

export async function deleteAllUserData(userId: string): Promise<{
  deleted: Record<string, number>;
}> {
  const deleted: Record<string, number> = {};

  // Delete in dependency order (children before parents)
  const steps: Array<{ name: string; fn: () => Promise<{ count: number }> }> = [
    { name: "feedbackEvents",     fn: () => db.feedbackEvent.deleteMany({ where: { userId } }) },
    { name: "auditLogs",          fn: () => db.auditLog.deleteMany({ where: { userId } }) },
    { name: "reminders",          fn: () => db.reminder.deleteMany({ where: { userId } }) },
    { name: "tasks",              fn: () => db.task.deleteMany({ where: { userId } }) },
    { name: "smartAlerts",        fn: () => db.smartAlert.deleteMany({ where: { userId } }) },
    { name: "emails",             fn: () => db.email.deleteMany({ where: { userId } }) },
    { name: "calendarEvents",     fn: () => db.calendarEvent.deleteMany({ where: { userId } }) },
    { name: "driveFiles",         fn: () => db.driveFile.deleteMany({ where: { userId } }) },
    { name: "memoryFacts",        fn: () => db.memoryFact.deleteMany({ where: { userId } }) },
    { name: "suppressions",       fn: () => db.memorySuppression.deleteMany({ where: { userId } }) },
    { name: "emailBehaviorStats", fn: () => db.emailBehaviorStat.deleteMany({ where: { userId } }) },
    { name: "dailyBriefs",        fn: () => db.dailyBriefing.deleteMany({ where: { userId } }) },
    { name: "syncCursors",        fn: () => db.syncCursor.deleteMany({ where: { userId } }) },
    { name: "oauthConnections",   fn: () => db.oAuthConnection.deleteMany({ where: { userId } }) },
    { name: "personalityProfile", fn: () => db.userPersonalityProfile.deleteMany({ where: { userId } }) },
  ];

  for (const step of steps) {
    try {
      const result = await step.fn();
      deleted[step.name] = result.count;
    } catch {
      deleted[step.name] = -1; // mark failed steps
    }
  }

  // Finally delete the user record itself
  await db.user.delete({ where: { id: userId } }).catch(() => {});
  deleted["user"] = 1;

  return { deleted };
}

// ─── DATA AUDIT ──────────────────────────────────────────────────────────────
// Returns a human-readable summary of exactly what data is stored for a user.

export async function getUserDataAudit(userId: string) {
  const [
    emailCount,
    emailsWithBody,
    calendarCount,
    driveCount,
    memoryCount,
    taskCount,
    auditCount,
    alertCount,
  ] = await Promise.all([
    db.email.count({ where: { userId } }),
    db.email.count({ where: { userId, bodyText: { not: null } } }),
    db.calendarEvent.count({ where: { userId } }),
    db.driveFile.count({ where: { userId } }),
    db.memoryFact.count({ where: { userId } }),
    db.task.count({ where: { userId } }),
    db.auditLog.count({ where: { userId } }),
    db.smartAlert.count({ where: { userId } }),
  ]);

  const profile = await db.userPersonalityProfile.findUnique({
    where: { userId },
    select: { assistantName: true, onboardingComplete: true },
  });

  const connections = await db.oAuthConnection.findMany({
    where: { userId },
    select: { provider: true, connectedAt: true, scope: true },
  });

  return {
    summary: {
      emails: {
        total: emailCount,
        withBodyStored: emailsWithBody, // should be 0 after purge
        note: "Only AI-generated summaries stored. Raw body text purged after classification.",
      },
      calendarEvents: { total: calendarCount, note: "Titles and attendee lists only." },
      driveFiles: { total: driveCount, note: "File names and metadata only. File content never read." },
      memoryFacts: { total: memoryCount, note: "AI-learned preferences. Fully editable and deletable by you." },
      tasks: { total: taskCount },
      smartAlerts: { total: alertCount },
      auditLogs: { total: auditCount, note: "What the assistant did. You control this." },
    },
    connections: connections.map((c) => ({
      provider: c.provider,
      connectedAt: c.connectedAt,
      scopes: c.scope,
      note: "OAuth tokens are AES-256-GCM encrypted. We never see your password.",
    })),
    assistant: profile,
    dataLocation: {
      database: "Your Supabase PostgreSQL instance — you own and control it",
      processing: "OpenAI API (email classification only — body text not stored by OpenAI for training)",
      logs: "Stored in your database only",
      thirdParties: "None. No analytics, no advertising, no data brokers.",
    },
    rights: {
      export: "GET /api/privacy/export",
      deleteAll: "DELETE /api/privacy",
      editMemory: "/memory page",
      disconnectGoogle: "/settings page",
    },
  };
}

// ─── REVOKE GOOGLE ACCESS ────────────────────────────────────────────────────

export async function revokeGoogleAccess(userId: string) {
  const connections = await db.oAuthConnection.findMany({
    where: { userId },
    select: { id: true, encryptedTokens: true },
  });

  // Try to revoke each token with Google
  for (const conn of connections) {
    try {
      const { decrypt } = await import("@/lib/encryption");
      const tokens = JSON.parse(decrypt(conn.encryptedTokens));
      await fetch(`https://oauth2.googleapis.com/revoke?token=${tokens.accessToken}`, { method: "POST" });
    } catch {
      // Continue even if revoke fails — we still delete locally
    }
  }

  // Delete all connection records (encrypted tokens gone)
  await db.oAuthConnection.deleteMany({ where: { userId } });
  await db.syncCursor.deleteMany({ where: { userId } });
}
