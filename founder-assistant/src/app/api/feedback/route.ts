import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { learnFromFeedback } from "@/services/memory.service";
import { z } from "zod";

const FeedbackSchema = z.object({
  emailId: z.string(),
  type: z.enum(["important", "seen", "later", "ignore", "not_relevant", "wrong_category"]),
  notes: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = FeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  const { emailId, type, notes } = parsed.data;

  // Verify email belongs to this user
  const email = await db.email.findFirst({ where: { id: emailId, userId: session.user.id } });
  if (!email) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const TYPE_MAP: Record<string, any> = {
    important: "IMPORTANT",
    seen: "SEEN",
    later: "LATER",
    ignore: "IGNORE",
    not_relevant: "NOT_RELEVANT",
    wrong_category: "WRONG_CATEGORY",
  };

  await db.feedbackEvent.create({
    data: {
      userId: session.user.id,
      emailId,
      type: TYPE_MAP[type],
      notes,
    },
  });

  // Learn from this feedback
  await learnFromFeedback({ userId: session.user.id, emailId, feedbackType: type as any });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "USER_FEEDBACK",
      detail: `User marked email ${emailId} as: ${type}`,
      meta: { emailId, type },
    },
  });

  return NextResponse.json({ success: true, data: { learned: true } });
}
