import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { format } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const today = format(new Date(), "yyyy-MM-dd");

  const briefing = await db.dailyBriefing.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (!briefing) {
    try {
      if (redis) {
        const { enqueueBriefing } = await import("@/workers/queues");
        await enqueueBriefing(userId, today);
        return NextResponse.json({ success: true, data: { status: "generating", date: today } });
      } else {
        // Redis unavailable — generate inline
        const { generateDailyBriefing } = await import("@/services/briefing.service");
        const generated = await generateDailyBriefing(userId, today);
        return NextResponse.json({ success: true, data: generated });
      }
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, data: briefing });
}
