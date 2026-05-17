import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { decrypt } from "@/lib/encryption";
import { db } from "@/lib/db";
import type { GoogleTokens, GmailMessage } from "@/types";

// ─── AUTH CLIENT ──────────────────────────────────────────────────────────────

export async function getGmailClient(userId: string): Promise<OAuth2Client> {
  const conn = await db.oAuthConnection.findUniqueOrThrow({
    where: { userId_provider: { userId, provider: "GMAIL" } },
  });

  const tokens: GoogleTokens = JSON.parse(decrypt(conn.encryptedTokens));

  const auth = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  });

  auth.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiresAt,
  });

  // Auto-refresh if needed
  auth.on("tokens", async (newTokens) => {
    const updated: GoogleTokens = {
      accessToken: newTokens.access_token ?? tokens.accessToken,
      refreshToken: newTokens.refresh_token ?? tokens.refreshToken,
      expiresAt: newTokens.expiry_date ?? tokens.expiresAt,
    };
    await db.oAuthConnection.update({
      where: { userId_provider: { userId, provider: "GMAIL" } },
      data: {
        encryptedTokens: (await import("@/lib/encryption")).encrypt(JSON.stringify(updated)),
        lastRefreshedAt: new Date(),
      },
    });
  });

  return auth;
}

// ─── INCREMENTAL SYNC ────────────────────────────────────────────────────────

export interface GmailSyncResult {
  messages: GmailMessage[];
  newHistoryId: string;
}

export async function syncGmailIncremental(
  userId: string,
  historyId?: string
): Promise<GmailSyncResult> {
  const auth = await getGmailClient(userId);
  const gmail = google.gmail({ version: "v1", auth });

  let messageIds: string[] = [];
  let newHistoryId = historyId;

  if (historyId) {
    // Incremental: fetch only changes since last historyId
    try {
      const historyRes = await gmail.users.history.list({
        userId: "me",
        startHistoryId: historyId,
        historyTypes: ["messageAdded"],
        labelId: "INBOX",
      });
      newHistoryId = historyRes.data.historyId ?? historyId;
      const records = historyRes.data.history ?? [];
      messageIds = records.flatMap((r) => (r.messagesAdded ?? []).map((m) => m.message?.id!).filter(Boolean));
    } catch {
      // historyId expired — fall back to full 10-day sync
      return syncGmailFull(userId, 10);
    }
  } else {
    return syncGmailFull(userId, 10);
  }

  const messages = await fetchMessages(gmail, messageIds);
  return { messages, newHistoryId: newHistoryId! };
}

async function syncGmailFull(userId: string, daysBack: number): Promise<GmailSyncResult> {
  const auth = await getGmailClient(userId);
  const gmail = google.gmail({ version: "v1", auth });

  const after = Math.floor((Date.now() - daysBack * 86400_000) / 1000);

  // Two targeted queries: (1) Primary/important messages, (2) account update notifications.
  // This avoids drowning the batch in promotional emails from a busy inbox.
  const [primaryRes, updatesRes] = await Promise.all([
    gmail.users.messages.list({
      userId: "me",
      q: `after:${after} -label:spam -label:trash -category:promotions -category:social`,
      maxResults: 300,
    }),
    gmail.users.messages.list({
      userId: "me",
      q: `after:${after} -label:spam -label:trash category:updates`,
      maxResults: 200,
    }),
  ]);

  // Deduplicate across both result sets
  const seen = new Set<string>();
  const messageIds: string[] = [];
  for (const msg of [
    ...(primaryRes.data.messages ?? []),
    ...(updatesRes.data.messages ?? []),
  ]) {
    if (msg.id && !seen.has(msg.id)) {
      seen.add(msg.id);
      messageIds.push(msg.id);
    }
  }

  const profileRes = await gmail.users.getProfile({ userId: "me" });
  const newHistoryId = profileRes.data.historyId ?? "0";

  const messages = await fetchMessages(gmail, messageIds);
  return { messages, newHistoryId };
}

async function fetchMessages(
  gmail: ReturnType<typeof google.gmail>,
  ids: string[]
): Promise<GmailMessage[]> {
  // Batch in groups of 20 to avoid rate limits
  const results: GmailMessage[] = [];
  const chunks = chunkArray(ids, 20);

  for (const chunk of chunks) {
    const fetched = await Promise.allSettled(
      chunk.map((id) =>
        gmail.users.messages.get({
          userId: "me",
          id,
          format: "full",
        })
      )
    );

    for (const res of fetched) {
      if (res.status === "fulfilled") {
        const msg = parseGmailMessage(res.value.data);
        if (msg) results.push(msg);
      }
    }
  }

  return results;
}

function parseGmailMessage(raw: any): GmailMessage | null {
  try {
    const headers = raw.payload?.headers ?? [];
    const get = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

    const fromRaw = get("From");
    const fromMatch = fromRaw.match(/^(.*?)\s*<(.+)>$/) ?? [null, null, fromRaw];
    const fromName = fromMatch[1]?.replace(/"/g, "").trim() || null;
    const fromAddress = (fromMatch[2] || fromRaw).trim();

    const toRaw = get("To");
    const toAddresses = toRaw.split(",").map((t: string) => t.trim()).filter(Boolean);

    const bodyText = extractBodyText(raw.payload);

    return {
      id: raw.id,
      threadId: raw.threadId,
      subject: get("Subject") || "(no subject)",
      from: fromAddress,
      fromName,
      to: toAddresses,
      snippet: raw.snippet ?? "",
      bodyText,
      receivedAt: new Date(parseInt(raw.internalDate)),
      internalDate: BigInt(raw.internalDate ?? "0"),
      labels: raw.labelIds ?? [],
      threadSize: 1, // updated by thread fetch
    };
  } catch {
    return null;
  }
}

function extractBodyText(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf8");
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBodyText(part);
      if (text) return text;
    }
  }
  return "";
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// ─── SUPPRESSION CHECK ───────────────────────────────────────────────────────

export function isLikelyCruft(msg: GmailMessage): boolean {
  const labels = new Set(msg.labels);
  // CATEGORY_UPDATES = account alerts, receipts, payment notifications — let AI classify these
  if (labels.has("CATEGORY_PROMOTIONS") || labels.has("CATEGORY_SOCIAL")) return true;
  if (labels.has("SPAM")) return true;
  const subjectLower = msg.subject.toLowerCase();
  if (subjectLower.includes("unsubscribe") || subjectLower.includes("newsletter")) return true;
  return false;
}
