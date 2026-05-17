import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { format } from "date-fns";
import { EmailCard } from "@/components/email-card";
import type { DashboardEmail } from "@/types";

export const dynamic = "force-dynamic";

const GROUP_MAP: Record<string, { label: string; icon: string }> = {
  URGENT: { label: "Urgent", icon: "🔥" },
  ACTION_REQUIRED: { label: "Action Required", icon: "💬" },
  WATCH: { label: "Watch", icon: "👁" },
  INFORMATIONAL: { label: "Informational", icon: "ℹ️" },
};

export default async function EmailsPage() {
  const session = await auth();
  const userId = session!.user!.id!;
  const since = new Date(Date.now() - 10 * 86400_000);

  const [emails, totalCount, suppressedCount] = await Promise.all([
    db.email.findMany({
      where: {
        userId,
        receivedAt: { gte: since },
        importanceScore: { gte: 60 },
        category: { notIn: ["NEWSLETTER", "PROMO", "IGNORE"] },
        isDeleted: false,
      },
      orderBy: [{ importanceScore: "desc" }, { receivedAt: "desc" }],
      take: 30,
    }),
    db.email.count({ where: { userId, receivedAt: { gte: since } } }),
    db.email.count({
      where: { userId, receivedAt: { gte: since }, category: { in: ["NEWSLETTER", "PROMO", "IGNORE"] } },
    }),
  ]);

  const dashEmails: DashboardEmail[] = emails.map((e) => ({
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

  return (
    <div>
      <div className="mb-5">
        <div className="text-[11px] text-amber-400 font-bold uppercase tracking-widest mb-1.5">
          Important emails · Last 10 days
        </div>
        <h2
          className="text-2xl font-bold text-slate-100 mb-2"
          style={{ fontFamily: "var(--font-dm-serif)" }}
        >
          What happened in your inbox
        </h2>
        <p className="text-[13px] text-slate-500">
          {emails.length} signals surfaced from {totalCount} messages.{" "}
          {suppressedCount} suppressed (spam/promos/newsletters).
        </p>
      </div>

      {dashEmails.length === 0 ? (
        <div className="text-center py-16 text-slate-600">
          <div className="text-3xl mb-3">📭</div>
          <div className="text-sm">No important emails in the last 10 days.</div>
          <div className="text-xs text-slate-700 mt-2">
            Try syncing your Gmail first.
          </div>
        </div>
      ) : (
        <div>
          {dashEmails.map((email) => (
            <EmailCard key={email.id} email={email} />
          ))}
        </div>
      )}
    </div>
  );
}
