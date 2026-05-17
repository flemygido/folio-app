import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildMemoryContext } from "@/services/memory.service";
import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ChatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(10)
    .optional(),
});

// Tool Aria can call to search any email — no score/category filter
async function runSearchEmails(userId: string, query: string): Promise<string> {
  const since = new Date(Date.now() - 30 * 86400_000); // 30 days back for search
  const emails = await db.email.findMany({
    where: {
      userId,
      isDeleted: false,
      receivedAt: { gte: since },
      OR: [
        { subject: { contains: query, mode: "insensitive" } },
        { fromName: { contains: query, mode: "insensitive" } },
        { fromAddress: { contains: query, mode: "insensitive" } },
        { snippet: { contains: query, mode: "insensitive" } },
        { shortSummary: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { receivedAt: "desc" },
    take: 8,
    select: {
      subject: true,
      fromName: true,
      fromAddress: true,
      shortSummary: true,
      actionNeeded: true,
      dueDate: true,
      receivedAt: true,
      alreadyInformed: true,
      importanceScore: true,
      category: true,
    },
  });

  if (emails.length) {
    return emails
      .map(
        (e) =>
          `- ${e.alreadyInformed ? "✓" : "•"} [${e.category ?? "?"}/${e.importanceScore}] ${e.fromName ?? e.fromAddress}: "${e.subject}" (${e.receivedAt.toLocaleDateString()})` +
          (e.shortSummary ? ` — ${e.shortSummary}` : "") +
          (e.actionNeeded ? ` [Action needed: ${e.actionNeeded}]` : "")
      )
      .join("\n");
  }

  // Fallback: search Gmail directly for emails not yet synced into Folio
  try {
    const { getGmailClient } = await import("@/lib/google/gmail");
    const gmailAuth = await getGmailClient(userId);
    const gmailClient = google.gmail({ version: "v1", auth: gmailAuth });

    const searchRes = await gmailClient.users.messages.list({
      userId: "me",
      q: `${query} newer_than:30d -label:spam -label:trash`,
      maxResults: 6,
    });

    const messageList = searchRes.data.messages ?? [];
    if (!messageList.length) return `No emails found matching "${query}" in the last 30 days.`;

    const rawMessages = await Promise.allSettled(
      messageList.map((m) =>
        gmailClient.users.messages.get({
          userId: "me",
          id: m.id!,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "Date"],
        })
      )
    );

    const lines = rawMessages
      .filter((r) => r.status === "fulfilled")
      .map((r) => {
        const data = (r as PromiseFulfilledResult<any>).value.data;
        const headers: any[] = data.payload?.headers ?? [];
        const get = (name: string) =>
          headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
        return `- ${get("From")}: "${get("Subject")}" (${get("Date")})`;
      });

    return `Found in Gmail (not yet fully processed by Folio):\n${lines.join("\n")}\n\nTip: hit "Sync now" to pull these into Folio for full context.`;
  } catch {
    return `No emails found matching "${query}" in the last 30 days.`;
  }
}

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "searchEmails",
      description:
        "Search the user's synced emails by keyword. Call this when the user asks about a specific sender, company, topic, or email they might have received — even if it wasn't flagged as important.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search term — company name, sender, topic, or keyword (e.g. 'Razorpay', 'job', 'invoice')",
          },
        },
        required: ["query"],
      },
    },
  },
];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = ChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid" }, { status: 400 });
  }

  const userId = session.user.id;

  const [profile, memoryContext, recentAlerts, urgentTasks, importantEmails] = await Promise.all([
    db.userPersonalityProfile.findUnique({ where: { userId } }),
    buildMemoryContext(userId),
    db.smartAlert.findMany({
      where: { userId, isDismissed: false, isRead: false },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { type: true, title: true, body: true, urgency: true },
    }),
    db.task.findMany({
      where: { userId, status: "OPEN", priority: { in: ["URGENT", "HIGH"] } },
      orderBy: { priority: "asc" },
      take: 5,
      select: { title: true, priority: true, dueAt: true },
    }),
    db.email.findMany({
      where: {
        userId,
        importanceScore: { gte: 55 },
        isDeleted: false,
        receivedAt: { gte: new Date(Date.now() - 14 * 86400_000) },
        category: { notIn: ["NEWSLETTER", "PROMO", "IGNORE"] },
      },
      orderBy: [{ alreadyInformed: "asc" }, { importanceScore: "desc" }],
      take: 15,
      select: {
        subject: true,
        fromName: true,
        fromAddress: true,
        shortSummary: true,
        actionNeeded: true,
        dueDate: true,
        alreadyInformed: true,
      },
    }),
  ]);

  const assistantName = profile?.assistantName ?? "Aria";
  const tone =
    profile?.assistantPersonality === "DIRECT_EFFICIENT"
      ? "direct and brief"
      : profile?.assistantPersonality === "WARM_SUPPORTIVE"
      ? "warm and supportive"
      : profile?.assistantPersonality === "ENERGETIC"
      ? "energetic and motivating"
      : "calm and professional";

  const systemPrompt = `You are ${assistantName}, an AI work assistant helping a professional manage their inbox, calendar, and tasks.
Your tone is ${tone}. Be ${profile?.briefingTone === "concise" ? "brief and to the point" : "thorough but clear"}.

Memory context:
${memoryContext}

Proactively surfaced important emails (last 14 days — ✓ = already handled by user):
${importantEmails.map((e) => `- ${e.alreadyInformed ? "✓" : "•"} ${e.fromName ?? e.fromAddress}: "${e.subject}" — ${e.shortSummary ?? ""} ${e.actionNeeded ? `(Action: ${e.actionNeeded})` : ""}`).join("\n") || "None"}

Unread alerts (${recentAlerts.length}):
${recentAlerts.map((a) => `- [${a.urgency}] ${a.title}: ${a.body}`).join("\n") || "None"}

Open urgent tasks:
${urgentTasks.map((t) => `- [${t.priority}] ${t.title}${t.dueAt ? ` (due ${t.dueAt.toDateString()})` : ""}`).join("\n") || "None"}

Current date: ${new Date().toDateString()}

Rules:
- If the user asks about a specific sender, company, or topic that's not in the context above, call searchEmails to look it up — never say you don't know without searching first
- Never make up emails that aren't in context or search results
- Be concise and actionable
- Do not repeat what was already said in this conversation`;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...(parsed.data.history ?? []).map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: parsed.data.message },
  ];

  // First call — Aria may request a tool
  const firstResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    tools: TOOLS,
    tool_choice: "auto",
    max_tokens: 500,
    temperature: 0.7,
  });

  const firstChoice = firstResponse.choices[0];
  let reply = firstChoice?.message?.content ?? "";

  // Handle tool calls
  if (firstChoice?.message?.tool_calls?.length) {
    const toolCallMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      ...messages,
      firstChoice.message,
    ];

    for (const toolCall of firstChoice.message.tool_calls) {
      if (toolCall.function.name === "searchEmails") {
        const { query } = JSON.parse(toolCall.function.arguments) as { query: string };
        const result = await runSearchEmails(userId, query);
        toolCallMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }
    }

    const finalResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: toolCallMessages,
      max_tokens: 500,
      temperature: 0.7,
    });

    reply = finalResponse.choices[0]?.message?.content ?? "I couldn't process that.";
  }

  if (!reply) reply = "I couldn't process that.";

  await db.auditLog.create({
    data: {
      userId,
      action: "USER_FEEDBACK",
      detail: `Widget chat: "${parsed.data.message.slice(0, 60)}"`,
      meta: { type: "chat" },
    },
  });

  return NextResponse.json({ success: true, data: { reply } });
}
