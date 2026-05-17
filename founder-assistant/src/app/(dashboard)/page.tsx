import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { format } from "date-fns";
import { EmailCard } from "@/components/email-card";
import { TaskRow } from "@/components/task-row";
import type { DashboardEmail, DashboardTask, DashboardCalendarEvent } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GROUP_MAP: Record<string, { label: string; icon: string }> = {
  URGENT: { label: "Urgent", icon: "🔴" },
  ACTION_REQUIRED: { label: "Action Required", icon: "🟠" },
  WATCH: { label: "Watch", icon: "👁" },
  INFORMATIONAL: { label: "Info", icon: "ℹ️" },
};

export default async function BriefingPage() {
  const session = await auth();
  const userId = session!.user!.id!;
  const today = format(new Date(), "yyyy-MM-dd");
  const userName = session!.user!.name?.split(" ")[0] ?? "there";

  const [briefing, importantEmails, upcomingEvents, openTasks] = await Promise.all([
    db.dailyBriefing.findUnique({ where: { userId_date: { userId, date: today } } }),
    db.email.findMany({
      where: {
        userId,
        importanceScore: { gte: 75 },
        alreadyInformed: false,
        isDeleted: false,
        category: { notIn: ["NEWSLETTER", "PROMO", "IGNORE"] },
      },
      orderBy: [{ importanceScore: "desc" }, { receivedAt: "desc" }],
      take: 10,
    }),
    db.calendarEvent.findMany({
      where: { userId, startTime: { gte: new Date() }, isDeleted: false, importance: { not: "low" } },
      orderBy: { startTime: "asc" },
      take: 4,
    }),
    db.task.findMany({
      where: { userId, status: "OPEN", priority: { in: ["URGENT", "HIGH"] } },
      orderBy: [{ priority: "asc" }, { dueAt: "asc" }],
      take: 6,
    }),
  ]);

  const emails: DashboardEmail[] = importantEmails.map((e) => ({
    id: e.id,
    group: GROUP_MAP[e.category ?? "INFORMATIONAL"]?.label ?? (e.category ?? ""),
    groupIcon: GROUP_MAP[e.category ?? "INFORMATIONAL"]?.icon ?? "•",
    from: e.fromAddress,
    fromName: e.fromName ?? e.fromAddress,
    subject: e.subject,
    snippet: e.snippet ?? "",
    receivedAt: format(e.receivedAt, "MMM d, h:mm a"),
    score: e.importanceScore ?? 0,
    category: (e.category ?? "INFORMATIONAL").toLowerCase() as any,
    whyMatters: e.whyImportant ?? "",
    actionNeeded: e.actionNeeded,
    dueDate: e.dueDate,
    alreadyInformed: e.alreadyInformed,
    threadSize: e.threadSize,
  }));

  const tasks: DashboardTask[] = openTasks.map((t) => ({
    id: t.id,
    title: t.title,
    source: t.source,
    priority: t.priority.toLowerCase() as any,
    due: t.dueAt ? format(t.dueAt, "MMM d") : null,
    done: t.status === "DONE",
  }));

  const urgentCount = openTasks.filter((t) => t.priority === "URGENT").length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="text-[11px] text-amber-400 font-bold uppercase tracking-widest mb-1.5">
          Daily Briefing · {format(new Date(), "EEEE, MMMM d yyyy")}
        </div>
        <h1
          className="text-3xl font-bold text-slate-100 leading-tight mb-2.5"
          style={{ fontFamily: "var(--font-dm-serif)" }}
        >
          Good morning, {userName}.
        </h1>
        {briefing?.narrative ? (
          <p className="text-[14px] text-slate-500 leading-relaxed max-w-2xl">
            {briefing.headline}
          </p>
        ) : (
          <p className="text-[14px] text-slate-500 leading-relaxed">
            {importantEmails.length > 0
              ? `${importantEmails.length} things need your attention. ${urgentCount > 0 ? `${urgentCount} urgent.` : ""}`
              : "Your inbox is clear. Nothing urgent today."}
          </p>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-2.5 mb-6">
        {[
          { label: "Signal score", value: briefing?.signalScore ?? "—", unit: "/100", color: "#f59e0b" },
          { label: "Important items", value: importantEmails.length, unit: " today", color: "#fb923c" },
          { label: "Urgent tasks", value: urgentCount, unit: " open", color: "#f87171" },
          { label: "Tasks done", value: 0, unit: ` of ${openTasks.length}`, color: "#22c55e" },
        ].map((s) => (
          <div key={s.label} className="bg-[#0f172a] border border-slate-800 rounded-xl p-4">
            <div className="text-xl font-bold font-mono" style={{ color: s.color }}>
              {s.value}<span className="text-[11px] text-slate-600">{s.unit}</span>
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Urgent emails */}
      {emails.length > 0 && (
        <section className="mb-6">
          <div className="text-xs text-amber-400 font-bold uppercase tracking-widest mb-3">
            🔥 Needs your attention
          </div>
          <EmailCardList emails={emails} />
        </section>
      )}

      {/* Calendar */}
      {upcomingEvents.length > 0 && (
        <section className="mb-6">
          <div className="text-xs text-blue-300 font-bold uppercase tracking-widest mb-3">
            📅 Upcoming this week
          </div>
          <div className="space-y-2">
            {upcomingEvents.map((evt) => (
              <div
                key={evt.id}
                className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 flex gap-3 items-start"
                style={{ borderColor: evt.importance === "high" ? "#78350f" : "#1e293b" }}
              >
                <div className="text-xl">📅</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-200" style={{ fontFamily: "var(--font-dm-serif)" }}>
                    {evt.title}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {format(evt.startTime, "EEE h:mm a")} · {Array.isArray(evt.attendees)
                      ? (evt.attendees as any[]).slice(0, 3).map((a: any) => a.name ?? a.email).join(", ")
                      : ""}
                  </div>
                  {evt.prepNote && (
                    <div className="mt-2 text-xs text-blue-300 bg-[#0a1628] border border-[#1e3a5f] rounded-md px-3 py-1.5">
                      💡 {evt.prepNote}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Urgent tasks */}
      {tasks.length > 0 && (
        <section>
          <div className="text-xs text-green-300 font-bold uppercase tracking-widest mb-3">
            ✓ Extracted tasks
          </div>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </section>
      )}

      {emails.length === 0 && tasks.length === 0 && (
        <div className="text-center py-16 text-slate-600">
          <div className="text-3xl mb-3">✓</div>
          <div className="text-sm">Nothing urgent today. Your inbox is clear.</div>
        </div>
      )}
    </div>
  );
}

function EmailCardList({ emails }: { emails: DashboardEmail[] }) {
  return (
    <div>
      {emails.map((email) => (
        <EmailCard key={email.id} email={email} />
      ))}
    </div>
  );
}
