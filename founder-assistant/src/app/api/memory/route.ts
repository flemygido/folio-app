import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const [facts, suppressions] = await Promise.all([
    db.memoryFact.findMany({
      where: { userId: session.user.id },
      orderBy: [{ type: "asc" }, { confidence: "desc" }],
    }),
    db.memorySuppression.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ success: true, data: { facts, suppressions } });
}

const ToggleSchema = z.object({
  id: z.string(),
  isActive: z.boolean(),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = ToggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  const fact = await db.memoryFact.findFirst({
    where: { id: parsed.data.id, userId: session.user.id },
  });
  if (!fact) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const updated = await db.memoryFact.update({
    where: { id: parsed.data.id },
    data: { isActive: parsed.data.isActive },
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "id required" }, { status: 400 });

  const fact = await db.memoryFact.findFirst({ where: { id, userId: session.user.id } });
  if (!fact) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  await db.memoryFact.delete({ where: { id } });
  return NextResponse.json({ success: true, data: { deleted: id } });
}
