"use client";

import type { DashboardTask } from "@/types";

const PRIORITY_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  urgent: { bg: "#7c2d12", color: "#fed7aa", border: "#9a3412" },
  high: { bg: "#1e3a5f", color: "#93c5fd", border: "#1d4ed8" },
  medium: { bg: "#1c2a1c", color: "#86efac", border: "#166534" },
  low: { bg: "#1e293b", color: "#94a3b8", border: "#334155" },
};

interface TaskRowProps {
  task: DashboardTask;
  onToggle?: (id: string) => void;
}

export function TaskRow({ task, onToggle }: TaskRowProps) {
  const s = PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.low;

  return (
    <div
      className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg mb-1.5 border border-slate-800 transition-all duration-200"
      style={{ background: task.done ? "#070d16" : "#0f172a", opacity: task.done ? 0.45 : 1 }}
    >
      <div
        onClick={() => onToggle?.(task.id)}
        className="w-4.5 h-4.5 rounded cursor-pointer flex items-center justify-center flex-shrink-0 transition-all duration-200 border-2"
        style={{
          borderColor: task.done ? "#22c55e" : "#334155",
          background: task.done ? "#22c55e" : "transparent",
          width: 18,
          height: 18,
          borderRadius: 4,
        }}
      >
        {task.done && <span className="text-white text-[10px]">✓</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-[13px]"
          style={{
            color: task.done ? "#475569" : "#e2e8f0",
            textDecoration: task.done ? "line-through" : "none",
          }}
        >
          {task.title}
        </div>
        <div className="text-[11px] text-slate-600 mt-0.5">
          from {task.source} {task.due ? `· due ${task.due}` : ""}
        </div>
      </div>
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide border flex-shrink-0"
        style={{ background: s.bg, color: s.color, borderColor: s.border }}
      >
        {task.priority}
      </span>
    </div>
  );
}
