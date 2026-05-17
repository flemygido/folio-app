import { db } from "@/lib/db";
import { generateBriefing, extractTasks } from "@/lib/openai";
import { buildMemoryContext, markAsInformed } from "./memory.service";
import { getNewImportantEmails } from "./email.service";
import { format } from "date-fns";
import type { TaskPriority, TaskSource } from "@prisma/client";

const PRIORITY_MAP: Record<string, TaskPriority> = {
  urgent: "URGENT",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

const SOURCE_MAP: Record<string, TaskSource> = {
  email: "EMAIL",
  calendar: "CALENDAR",
};

export async function generateDailyBriefing(userId: string, localDate: string) {
  // Avoid double-generating
  const existing = await db.dailyBriefing.findUnique({ where: { userId_date: { userId, date: localDate } } });
  if (existing?.status === "READY") return existing;

  // Ensure record exists (upsert)
  const briefing = await db.dailyBriefing.upsert({
    where: { userId_date: { userId, date: localDate } },
    update: { status: "GENERATING" },
    create: { userId, date: localDate, status: "GENERATING" },
  });

  try {
    const [importantEmails, upcomingEvents, openTasks, memoryContext] = await Promise.all([
      getNewImportantEmails(userId),
      db.calendarEvent.findMany({
        where: { userId, startTime: { gte: new Date() }, isDeleted: false },
        orderBy: { startTime: "asc" },
        take: 8,
      }),
      db.task.count({ where: { userId, status: "OPEN" } }),
      buildMemoryContext(userId),
    ]);

    const urgentTasks = await db.task.count({
      where: { userId, status: "OPEN", priority: "URGENT" },
    });

    // Generate briefing narrative
    const result = await generateBriefing({
      date: format(new Date(), "EEEE, MMMM d yyyy"),
      importantEmails: importantEmails.map((e) => ({
        subject: e.subject,
        from: e.fromName ?? e.fromAddress,
        summary: e.shortSummary ?? e.snippet ?? "",
        category: (e.category ?? "INFORMATIONAL").toLowerCase(),
      })),
      upcomingEvents: upcomingEvents.map((e) => ({
        title: e.title,
        time: format(e.startTime, "EEE h:mm a"),
        prepNote: e.prepNote,
      })),
      openTasks,
      urgentTasks,
      memoryContext,
    });

    // Extract tasks from important emails
    if (importantEmails.length > 0) {
      const taskResult = await extractTasks({
        emails: importantEmails.slice(0, 10).map((e) => ({
          subject: e.subject,
          from: e.fromName ?? e.fromAddress,
          summary: e.shortSummary ?? e.snippet ?? "",
          dueDate: e.dueDate,
        })),
      });

      // Save extracted tasks (skip duplicates by title)
      const existingTitles = new Set(
        (await db.task.findMany({ where: { userId }, select: { title: true } })).map((t) => t.title)
      );

      const newTasks = taskResult.tasks.filter((t) => !existingTitles.has(t.title));
      if (newTasks.length > 0) {
        await db.task.createMany({
          data: newTasks.map((t) => ({
            userId,
            title: t.title,
            priority: PRIORITY_MAP[t.priority] ?? "MEDIUM",
            source: SOURCE_MAP[t.source_type] ?? "EMAIL",
          })),
        });
      }

      await db.auditLog.create({
        data: {
          userId,
          action: "EXTRACT_TASKS",
          detail: `Extracted ${newTasks.length} tasks from daily briefing`,
          meta: { count: newTasks.length },
        },
      });
    }

    // Mark emails as informed
    await markAsInformed(userId, importantEmails.map((e) => e.id), briefing.id);

    // Update briefing
    const updated = await db.dailyBriefing.update({
      where: { id: briefing.id },
      data: {
        status: "READY",
        signalScore: result.signal_score,
        unreadCount: importantEmails.length,
        importantCount: importantEmails.length,
        suppressedCount: 0, // updated separately
        headline: result.headline,
        narrative: result.narrative,
        generatedAt: new Date(),
      },
    });

    await db.auditLog.create({
      data: {
        userId,
        action: "GENERATE_BRIEFING",
        detail: `Daily briefing generated for ${localDate}`,
        meta: { importantCount: importantEmails.length, signalScore: result.signal_score },
      },
    });

    return updated;
  } catch (err) {
    await db.dailyBriefing.update({
      where: { id: briefing.id },
      data: { status: "FAILED" },
    });
    throw err;
  }
}
