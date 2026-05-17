import { graphFetch, graphFetchAll } from "./graph";

export interface TeamsChat {
  id: string;
  chatType: "oneOnOne" | "group" | "meeting" | "unknownFutureValue";
  topic: string | null;
  members: { email: string; name: string | null }[];
}

export interface TeamsMessageItem {
  id: string;
  chatId: string;
  chatName: string | null;
  chatType: string | null;
  senderName: string | null;
  senderAddress: string | null;
  content: string;
  receivedAt: Date;
}

// Fetch recent chats and their messages (last 3 days, top 5 active chats)
export async function syncTeamsMessages(userId: string): Promise<TeamsMessageItem[]> {
  const since = new Date(Date.now() - 3 * 86400_000).toISOString();

  // Get recent chats
  const chatsData = await graphFetch(
    userId,
    "MICROSOFT_TEAMS",
    `/me/chats?$expand=members&$top=20`
  );
  const chats: any[] = chatsData.value ?? [];

  const results: TeamsMessageItem[] = [];

  // For each chat, fetch recent messages (parallel, cap at 10 chats)
  const activeChatIds = chats.slice(0, 10).map((c: any) => c.id);

  await Promise.allSettled(
    activeChatIds.map(async (chatId: string) => {
      const chat = chats.find((c: any) => c.id === chatId);
      try {
        const messagesData = await graphFetch(
          userId,
          "MICROSOFT_TEAMS",
          `/me/chats/${chatId}/messages?$top=20&$orderby=createdDateTime desc`
        );
        const messages: any[] = messagesData.value ?? [];

        const chatName = chat?.topic || buildChatName(chat?.members ?? []);
        const chatType = chat?.chatType ?? null;

        for (const msg of messages) {
          if (msg.messageType !== "message") continue;
          const receivedAt = new Date(msg.createdDateTime);
          if (receivedAt < new Date(since)) continue;
          if (!msg.body?.content) continue;

          const content = stripTeamsHtml(msg.body.content).slice(0, 2000);
          if (!content.trim()) continue;

          results.push({
            id: msg.id,
            chatId,
            chatName,
            chatType,
            senderName: msg.from?.user?.displayName ?? null,
            senderAddress: msg.from?.user?.userPrincipalName ?? null,
            content,
            receivedAt,
          });
        }
      } catch { /* skip inaccessible chats */ }
    })
  );

  return results.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
}

function buildChatName(members: any[]): string | null {
  const names = members
    .map((m: any) => m.displayName ?? m.email ?? "")
    .filter(Boolean)
    .slice(0, 3);
  return names.length ? names.join(", ") : null;
}

function stripTeamsHtml(html: string): string {
  return html
    .replace(/<attachment[^>]*>[\s\S]*?<\/attachment>/gi, "[attachment]")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
