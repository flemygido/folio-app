import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const ActionSchema = z.object({
  action: z.enum(["archive", "mark-handled", "snooze"]),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  }

  const email = await db.email.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!email || email.userId !== session.user.id) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const { action } = parsed.data;

  if (action === "archive") {
    await db.email.update({
      where: { id },
      data: { isDeleted: true, alreadyInformed: true },
    });
  } else if (action === "mark-handled") {
    await db.email.update({
      where: { id },
      data: { alreadyInformed: true, informedAt: new Date() },
    });
  } else if (action === "snooze") {
    // Snooze: mark handled for now, will resurface on next sync as it won't be re-processed
    await db.email.update({
      where: { id },
      data: { alreadyInformed: true },
    });
  }

  return NextResponse.json({ success: true });
}
