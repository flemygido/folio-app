import { decrypt, encrypt } from "@/lib/encryption";
import { db } from "@/lib/db";

export interface MicrosoftTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// ─── TOKEN MANAGEMENT ────────────────────────────────────────────────────────

async function getValidTokens(userId: string, provider: "OUTLOOK" | "MICROSOFT_CALENDAR" | "MICROSOFT_TEAMS"): Promise<string> {
  const conn = await db.oAuthConnection.findUniqueOrThrow({
    where: { userId_provider: { userId, provider } },
  });

  const tokens: MicrosoftTokens = JSON.parse(decrypt(conn.encryptedTokens));

  // Refresh if expired (with 5 min buffer)
  if (tokens.expiresAt < Date.now() + 5 * 60_000) {
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    const updated: MicrosoftTokens = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
      expiresAt: Date.now() + refreshed.expires_in * 1000,
    };
    await db.oAuthConnection.update({
      where: { userId_provider: { userId, provider } },
      data: {
        encryptedTokens: encrypt(JSON.stringify(updated)),
        lastRefreshedAt: new Date(),
      },
    });
    return updated.accessToken;
  }

  return tokens.accessToken;
}

async function refreshAccessToken(refreshToken: string): Promise<any> {
  const params = new URLSearchParams({
    client_id: process.env.AZURE_AD_CLIENT_ID!,
    client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/common/oauth2/v2.0/token`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params }
  );

  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  return res.json();
}

// ─── GRAPH API FETCH HELPER ──────────────────────────────────────────────────

export async function graphFetch(
  userId: string,
  provider: "OUTLOOK" | "MICROSOFT_CALENDAR" | "MICROSOFT_TEAMS",
  path: string,
  options?: RequestInit
): Promise<any> {
  const token = await getValidTokens(userId, provider);
  const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph API ${path} → ${res.status}: ${body.slice(0, 200)}`);
  }

  return res.json();
}

// Paginate through all pages of a Graph API list response
export async function graphFetchAll(
  userId: string,
  provider: "OUTLOOK" | "MICROSOFT_CALENDAR" | "MICROSOFT_TEAMS",
  path: string,
  maxItems = 500
): Promise<any[]> {
  const results: any[] = [];
  let url: string | null = path;

  while (url && results.length < maxItems) {
    const data = await graphFetch(userId, provider, url);
    results.push(...(data.value ?? []));
    url = data["@odata.nextLink"] ?? null;
  }

  return results.slice(0, maxItems);
}
