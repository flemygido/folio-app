import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { DashboardMemoryFact } from "@/types";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  CONTACT: { label: "VIP Contacts", icon: "👤" },
  PROJECT: { label: "Active Projects", icon: "🎯" },
  PRIORITY: { label: "Priorities", icon: "📌" },
  PREFERENCE: { label: "Preferences", icon: "⚙️" },
  SUPPRESSION: { label: "Suppressed", icon: "🚫" },
  CONTEXT: { label: "Context", icon: "🧠" },
};

export default async function MemoryPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [facts, suppressions] = await Promise.all([
    db.memoryFact.findMany({
      where: { userId },
      orderBy: [{ type: "asc" }, { confidence: "desc" }],
    }),
    db.memorySuppression.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
  ]);

  const byType: Record<string, typeof facts> = {};
  for (const f of facts) {
    byType[f.type] = byType[f.type] ?? [];
    byType[f.type].push(f);
  }

  const activeFacts = facts.filter((f) => f.isActive).length;

  return (
    <div>
      <div className="mb-5">
        <div className="text-[11px] text-purple-400 font-bold uppercase tracking-widest mb-1.5">
          Memory Vault
        </div>
        <h2 className="text-2xl font-bold text-slate-100" style={{ fontFamily: "var(--font-dm-serif)" }}>
          What your assistant remembers
        </h2>
        <p className="text-[13px] text-slate-500 mt-1.5">
          {activeFacts} active facts · {suppressions.length} suppressions
        </p>
      </div>

      {Object.entries(byType).map(([type, typeFacts]) => {
        const info = TYPE_LABELS[type] ?? { label: type, icon: "•" };
        return (
          <div key={type} className="mb-5">
            <div className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mb-2.5">
              {info.icon} {info.label}
            </div>
            {typeFacts.map((fact) => (
              <div
                key={fact.id}
                className="flex gap-3 px-3.5 py-2.5 rounded-lg border border-slate-800 mb-1.5"
                style={{
                  background: fact.isActive ? "#0f172a" : "#070d16",
                  opacity: fact.isActive ? 1 : 0.4,
                }}
              >
                <div className="flex-1">
                  <div className="text-[13px] text-slate-200">{fact.value}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Source: {fact.source ?? "unknown"} · Confidence:{" "}
                    <span className="text-amber-400 font-mono">
                      {(fact.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide border"
                    style={{ background: "#2d1f47", color: "#c4b5fd", borderColor: "#7c3aed" }}
                  >
                    {type.toLowerCase()}
                  </span>
                  <ToggleButton factId={fact.id} isActive={fact.isActive} />
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {suppressions.length > 0 && (
        <div className="mb-5">
          <div className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mb-2.5">
            🚫 Suppressed Senders & Topics
          </div>
          {suppressions.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg border border-slate-800 bg-[#0f172a] mb-1.5"
              style={{ opacity: s.isActive ? 1 : 0.4 }}
            >
              <div className="flex-1">
                <div className="text-[13px] text-slate-300 font-mono">{s.pattern}</div>
                {s.reason && <div className="text-[11px] text-slate-600 mt-0.5">{s.reason}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {facts.length === 0 && suppressions.length === 0 && (
        <div className="text-center py-16 text-slate-600">
          <div className="text-3xl mb-3">🧠</div>
          <div className="text-sm">No memory yet. Sync your Gmail to start building context.</div>
        </div>
      )}
    </div>
  );
}

// Server action wrapper for toggling memory facts
function ToggleButton({ factId, isActive }: { factId: string; isActive: boolean }) {
  return (
    <form
      action={async () => {
        "use server";
        const { db: dbServer } = await import("@/lib/db");
        const { revalidatePath } = await import("next/cache");
        await dbServer.memoryFact.update({ where: { id: factId }, data: { isActive: !isActive } });
        revalidatePath("/memory");
      }}
    >
      <button
        type="submit"
        className="text-[10px] px-2 py-0.5 rounded border border-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
      >
        {isActive ? "Disable" : "Enable"}
      </button>
    </form>
  );
}
