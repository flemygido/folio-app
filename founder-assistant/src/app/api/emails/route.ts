import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const QuerySchema = z.object({
  days: z.coerce.number().min(1).max(30).default(10),
  minScore: z.coerce.number().min(0).max(100).default(60),
  category: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(30),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const params = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!params.success) {
    return NextResponse.json({ success: false, error: "Invalid params" }, { status: 400 });
  }

  const { days, minScore, category, limit } = params.data;
  const since = new Date(Date.now() - days * 86400_000);

  const emails = await db.email.findMany({
    where: {
      userId: session.user.id,
      receivedAt: { gte: since },
      importanceScore: { gte: minScore },
      isDeleted: false,
      ...(category ? { category: category as any } : {}),
    },
    orderBy: [{ importanceScore: "desc" }, { receivedAt: "desc" }],
    take: limit,
    select: {
      id: true,
      subject: true,
      fromAddress: true,
      fromName: true,
      snippet: true,
      receivedAt: true,
      importanceScore: true,
      category: true,
      whyImportant: true,
      shortSummary: true,
      actionNeeded: true,
      dueDate: true,
      alreadyInformed: true,
      threadSize: true,
    },
  });

  return NextResponse.json({ success: true, data: emails });
}
