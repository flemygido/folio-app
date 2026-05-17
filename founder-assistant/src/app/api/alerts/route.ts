import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const onlyUnread = searchParams.get("unread") === "true";

  const alerts = await db.smartAlert.findMany({
    where: {
      userId: session.user.id,
      isDismissed: false,
      ...(onlyUnread ? { isRead: false } : {}),
    },
    orderBy: [{ urgency: "asc" }, { createdAt: "desc" }],
    take: 20,
  });

  return NextResponse.json({ success: true, data: alerts });
}

const DismissSchema = z.object({
  id: z.string(),
  action: z.enum(["read", "dismiss"]),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = DismissSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid" }, { status: 400 });

  const alert = await db.smartAlert.findFirst({
    where: { id: parsed.data.id, userId: session.user.id },
  });
  if (!alert) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const updated = await db.smartAlert.update({
    where: { id: parsed.data.id },
    data: parsed.data.action === "dismiss" ? { isDismissed: true, isRead: true } : { isRead: true },
  });

  return NextResponse.json({ success: true, data: updated });
}
