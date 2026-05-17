import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { openai } from "@/lib/openai";
import { buildMemoryContext } from "@/services/memory.service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  const email = await db.email.findUnique({
    where: { id },
    select: {
      userId: true,
      subject: true,
      fromName: true,
      fromAddress: true,
      snippet: true,
      shortSummary: true,
      actionNeeded: true,
    },
  });

  if (!email || email.userId !== userId) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const [profile, memoryContext] = await Promise.all([
    db.userPersonalityProfile.findUnique({ where: { userId } }),
    buildMemoryContext(userId),
  ]);

  const userName = profile?.displayName ?? session.user.name ?? "there";
  const tone =
    profile?.assistantPersonality === "DIRECT_EFFICIENT"
      ? "direct and concise"
      : profile?.assistantPersonality === "WARM_SUPPORTIVE"
      ? "warm and personable"
      : "professional and clear";

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You draft email replies for ${userName}. Tone: ${tone}. Write natural, human replies — no fluff, no "I hope this email finds you well". Sign off as ${userName}.

Context about this person:
${memoryContext}`,
      },
      {
        role: "user",
        content: `Draft a reply to this email:

FROM: ${email.fromName ?? email.fromAddress}
SUBJECT: ${email.subject}
SUMMARY: ${email.shortSummary ?? email.snippet ?? "(no summary)"}
ACTION NEEDED: ${email.actionNeeded ?? "none specified"}

Write a complete, ready-to-send reply. Keep it under 150 words unless the situation requires more.`,
      },
    ],
    max_tokens: 300,
    temperature: 0.7,
  });

  const draft = response.choices[0]?.message?.content ?? "";

  return NextResponse.json({ success: true, data: { draft } });
}
