import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { format } from "date-fns";
import { TaskRow } from "@/components/task-row";
import type { DashboardTask } from "@/types";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const tasks = await db.task.findMany({
    where: { userId, status: { in: ["OPEN", "SNOOZED"] } },
    orderBy: [{ priority: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
  });

  const dashTasks: DashboardTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    source: t.source,
    priority: t.priority.toLowerCase() as any,
    due: t.dueAt ? format(t.dueAt, "MMM d") : null,
    done: t.status === "DONE",
  }));

  const byPriority: Record<string, DashboardTask[]> = {
    urgent: dashTasks.filter((t) => t.priority === "urgent"),
    high: dashTasks.filter((t) => t.priority === "high"),
    medium: dashTasks.filter((t) => t.priority === "medium"),
    low: dashTasks.filter((t) => t.priority === "low"),
  };

  const totalOpen = tasks.length;
  const urgentOpen = tasks.filter((t) => t.priority === "URGENT").length;

  return (
    <div>
      <div className="mb-5">
        <div className="text-[11px] text-green-400 font-bold uppercase tracking-widest mb-1.5">
          Tasks · AI-extracted
        </div>
        <h2 className="text-2xl font-bold text-slate-100" style={{ fontFamily: "var(--font-dm-serif)" }}>
          What needs doing
        </h2>
        <p className="text-[13px] text-slate-500 mt-1.5">
          {totalOpen} open · {urgentOpen} urgent
        </p>
      </div>

      {Object.entries(byPriority).map(([level, levelTasks]) => {
        if (!levelTasks.length) return null;
        return (
          <div key={level} className="mb-5">
            <div className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mb-2">
              {level}
            </div>
            {levelTasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        );
      })}

      {totalOpen === 0 && (
        <div className="text-center py-16 text-slate-600">
          <div className="text-3xl mb-3">✅</div>
          <div className="text-sm">No open tasks. You're all caught up.</div>
        </div>
      )}
    </div>
  );
}
