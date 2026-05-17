"use client";

interface ScoreBarProps {
  score: number;
}

export function ScoreBar({ score }: ScoreBarProps) {
  const color = score >= 90 ? "#f59e0b" : score >= 75 ? "#fb923c" : "#64748b";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-0.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="text-[10px] font-bold font-mono" style={{ color }}>
        {score}
      </span>
    </div>
  );
}
