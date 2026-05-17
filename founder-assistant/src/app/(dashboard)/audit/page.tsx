import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

const ACTION_COLORS: Record<string, string> = {
  SYNC_GMAIL: "#3b82f6",
  SYNC_CALENDAR: "#3b82f6",
  SYNC_DRIVE: "#3b82f6",
  CLASSIFY_EMAIL: "#f59e0b",
  GENERATE_BRIEFING: "#22c55e",
  EXTRACT_TASKS: "#fb923c",
  UPDATE_MEMORY: "#a855f7",
  USER_FEEDBACK: "#94a3b8",
  AUTH_LOGIN: "#64748b",
  TOKEN_REFRESH: "#64748b",
};

const ACTION_LABELS: Record<string, string> = {
  SYNC_GMAIL: "sync",
  SYNC_CALENDAR: "sync",
  SYNC_DRIVE: "sync",
  CLASSIFY_EMAIL: "ai",
  GENERATE_BRIEFING: "brief",
  EXTRACT_TASKS: "task",
  UPDATE_MEMORY: "memory",
  USER_FEEDBACK: "feedback",
  AUTH_LOGIN: "auth",
  TOKEN_REFRESH: "auth",
};

export default async function AuditPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const logs = await db.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <div className="mb-5">
        <div className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">
          Audit Log
        </div>
        <h2 className="text-2xl font-bold text-slate-100" style={{ fontFamily: "var(--font-dm-serif)" }}>
          What your assistant did
        </h2>
        <p className="text-[13px] text-slate-500 mt-1.5">
          Full transparency on every read, summarize, and store action.
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-16 text-slate-600">
          <div className="text-3xl mb-3">📜</div>
          <div className="text-sm">No activity yet. Start by syncing your Gmail.</div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {logs.map((entry) => {
            const color = ACTION_COLORS[entry.action] ?? "#64748b";
            const typeLabel = ACTION_LABELS[entry.action] ?? "sys";
            return (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-[#0f172a] border border-slate-800"
              >
                <span className="text-[11px] text-slate-600 font-mono flex-shrink-0">
                  {format(entry.createdAt, "HH:mm:ss")}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide flex-shrink-0"
                  style={{ background: `${color}22`, color }}
                >
                  {typeLabel}
                </span>
                <span className="text-xs text-slate-500 font-mono flex-shrink-0">
                  {entry.action.toLowerCase()}
                </span>
                <span className="text-xs text-slate-400 flex-1 truncate">
                  {entry.detail ?? "—"}
                </span>
                {entry.durationMs && (
                  <span className="text-[11px] text-slate-700 font-mono flex-shrink-0">
                    {entry.durationMs}ms
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
