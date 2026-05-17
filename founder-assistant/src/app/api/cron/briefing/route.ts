import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { format } from "date-fns";

// Vercel Cron: runs at 7am UTC (adjust per user timezone in future).
// Auto-generates daily briefings for all active users.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = format(new Date(), "yyyy-MM-dd");

  const users = await db.oAuthConnection.findMany({
    where: { provider: "GMAIL", isActive: true },
    select: { userId: true },
    take: 20,
  });

  const results = await Promise.allSettled(
    users.map(async ({ userId }) => {
      // Skip if briefing already generated today
      const existing = await db.dailyBriefing.findUnique({
        where: { userId_date: { userId, date: today } },
      });
      if (existing?.status === "READY") return;

      const { generateDailyBriefing } = await import("@/services/briefing.service");
      await generateDailyBriefing(userId, today);
    })
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ success: true, generated: succeeded });
}
