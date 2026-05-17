import { graphFetch, graphFetchAll } from "./graph";
import { db } from "@/lib/db";

export interface OutlookMessage {
  id: string;
  conversationId: string;
  subject: string;
  from: string;
  fromName: string | null;
  to: string[];
  snippet: string;
  bodyText: string;
  receivedAt: Date;
  isRead: boolean;
}

const MESSAGE_SELECT = [
  "id",
  "conversationId",
  "subject",
  "from",
  "toRecipients",
  "bodyPreview",
  "body",
  "receivedDateTime",
  "isRead",
  "categories",
  "importance",
].join(",");

// ─── INCREMENTAL SYNC ────────────────────────────────────────────────────────

export interface OutlookSyncResult {
  messages: OutlookMessage[];
  deltaLink: string;
}

export async function syncOutlookIncremental(
  userId: string,
  deltaLink?: string
): Promise<OutlookSyncResult> {
  const path = deltaLink ?? buildInitialDeltaUrl();

  const items: any[] = [];
  let nextUrl: string | null = path;
  let finalDeltaLink = deltaLink ?? "";

  // Walk pages — collect messages until we hit a deltaLink
  while (nextUrl) {
    const data = await graphFetch(userId, "OUTLOOK", nextUrl);
    items.push(...(data.value ?? []));
    nextUrl = data["@odata.nextLink"] ?? null;
    if (data["@odata.deltaLink"]) finalDeltaLink = data["@odata.deltaLink"];
    if (items.length >= 200) break; // cap per sync
  }

  const messages = items
    .filter((m) => !m["@removed"])
    .map(parseOutlookMessage)
    .filter(Boolean) as OutlookMessage[];

  return { messages, deltaLink: finalDeltaLink };
}

function buildInitialDeltaUrl(): string {
  const since = new Date(Date.now() - 10 * 86400_000).toISOString();
  const select = encodeURIComponent(MESSAGE_SELECT);
  const filter = encodeURIComponent(
    `receivedDateTime ge ${since} and isDraft eq false`
  );
  return `/me/mailFolders/inbox/messages/delta?$select=${select}&$filter=${filter}&$top=50`;
}

function parseOutlookMessage(raw: any): OutlookMessage | null {
  try {
    const fromEmail = raw.from?.emailAddress?.address ?? "";
    const fromName = raw.from?.emailAddress?.name?.trim() || null;
    const to = (raw.toRecipients ?? []).map(
      (r: any) => r.emailAddress?.address ?? ""
    );

    const bodyText =
      raw.body?.contentType === "text"
        ? raw.body.content ?? ""
        : stripHtml(raw.body?.content ?? "");

    return {
      id: raw.id,
      conversationId: raw.conversationId ?? raw.id,
      subject: raw.subject || "(no subject)",
      from: fromEmail,
      fromName,
      to,
      snippet: raw.bodyPreview ?? "",
      bodyText: bodyText.slice(0, 4000),
      receivedAt: new Date(raw.receivedDateTime),
      isRead: raw.isRead ?? false,
    };
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

// ─── SUPPRESSION CHECK ───────────────────────────────────────────────────────

export function isOutlookCruft(msg: OutlookMessage): boolean {
  const sub = msg.subject.toLowerCase();
  if (sub.includes("unsubscribe") || sub.includes("newsletter")) return true;
  return false;
}

// ─── ARCHIVE / MARK READ ─────────────────────────────────────────────────────

export async function archiveOutlookMessage(userId: string, messageId: string): Promise<void> {
  // Move to Archive folder
  await graphFetch(userId, "OUTLOOK", `/me/messages/${messageId}/move`, {
    method: "POST",
    body: JSON.stringify({ destinationId: "archive" }),
  });
}

export async function markOutlookRead(userId: string, messageId: string): Promise<void> {
  await graphFetch(userId, "OUTLOOK", `/me/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ isRead: true }),
  });
}
