import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(255),
  priority: z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  dueAt: z.string().datetime().optional(),
});

const UpdateTaskSchema = z.object({
  id: z.string(),
  status: z.enum(["OPEN", "DONE", "SNOOZED", "DISMISSED"]).optional(),
  priority: z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]).optional(),
  dueAt: z.string().datetime().nullish(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await db.task.findMany({
    where: { userId: session.user.id, status: { in: ["OPEN", "SNOOZED"] } },
    orderBy: [
      { priority: "asc" },
      { dueAt: "asc" },
      { createdAt: "desc" },
    ],
  });

  return NextResponse.json({ success: true, data: tasks });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 });
  }

  const task = await db.task.create({
    data: {
      userId: session.user.id,
      title: parsed.data.title,
      priority: parsed.data.priority,
      source: "MANUAL",
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined,
    },
  });

  return NextResponse.json({ success: true, data: task }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = UpdateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 });
  }

  const task = await db.task.findFirst({
    where: { id: parsed.data.id, userId: session.user.id },
  });
  if (!task) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const updated = await db.task.update({
    where: { id: parsed.data.id },
    data: {
      status: parsed.data.status,
      priority: parsed.data.priority,
      dueAt: parsed.data.dueAt === null ? null : parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined,
      completedAt: parsed.data.status === "DONE" ? new Date() : undefined,
    },
  });

  return NextResponse.json({ success: true, data: updated });
}
