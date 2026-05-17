"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

interface DataAudit {
  summary: {
    emails: { total: number; withBodyStored: number; note: string };
    calendarEvents: { total: number; note: string };
    driveFiles: { total: number; note: string };
    memoryFacts: { total: number; note: string };
    tasks: { total: number };
    smartAlerts: { total: number };
    auditLogs: { total: number; note: string };
  };
  connections: Array<{
    provider: string;
    connectedAt: string;
    scopes: string;
    note: string;
  }>;
  assistant: { assistantName: string | null; onboardingComplete: boolean } | null;
  dataLocation: Record<string, string>;
  rights: Record<string, string>;
}

export default function SettingsPage() {
  const [audit, setAudit] = useState<DataAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"purge" | "revoke" | "delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/privacy")
      .then((r) => r.json())
      .then(setAudit)
      .finally(() => setLoading(false));
  }, []);

  async function handleAction(action: "purge_bodies" | "revoke_google" | "delete_all") {
    setBusy(true);
    setMessage(null);
    try {
      if (action === "delete_all") {
        await fetch("/api/privacy", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
        setMessage("All data deleted. Signing you out…");
        setTimeout(() => signOut({ callbackUrl: "/" }), 2000);
        return;
      }
      const res = await fetch("/api/privacy", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (action === "purge_bodies") setMessage(`Purged ${data.purged} stored email bodies.`);
      if (action === "revoke_google") setMessage("Google access revoked. Sync is now disabled.");
      // Refresh audit
      const fresh = await fetch("/api/privacy").then((r) => r.json());
      setAudit(fresh);
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Privacy & Data</h1>
        <p className="text-sm text-slate-400 mt-1">
          Everything stored about you — and controls to delete it.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300">
          {message}
        </div>
      )}

      {/* What we store */}
      {audit && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">What&apos;s stored</h2>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] divide-y divide-white/5">
            <AuditRow label="Emails" count={audit.summary.emails.total} note={audit.summary.emails.note}>
              {audit.summary.emails.withBodyStored > 0 && (
                <span className="text-xs text-amber-400 ml-2">
                  {audit.summary.emails.withBodyStored} with body text still stored
                </span>
              )}
            </AuditRow>
            <AuditRow label="Calendar events" count={audit.summary.calendarEvents.total} note={audit.summary.calendarEvents.note} />
            <AuditRow label="Drive files indexed" count={audit.summary.driveFiles.total} note={audit.summary.driveFiles.note} />
            <AuditRow label="Memory facts" count={audit.summary.memoryFacts.total} note={audit.summary.memoryFacts.note} />
            <AuditRow label="Tasks" count={audit.summary.tasks.total} />
            <AuditRow label="Smart alerts" count={audit.summary.smartAlerts.total} />
            <AuditRow label="Audit logs" count={audit.summary.auditLogs.total} note={audit.summary.auditLogs.note} />
          </div>
        </section>
      )}

      {/* Data location */}
      {audit && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Where data lives</h2>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
            {Object.entries(audit.dataLocation).map(([key, val]) => (
              <div key={key}>
                <span className="text-xs font-medium text-slate-400 capitalize">{key}</span>
                <p className="text-sm text-slate-300 mt-0.5">{val}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Connected accounts */}
      {audit && audit.connections.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Connected accounts</h2>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] divide-y divide-white/5">
            {audit.connections.map((c) => (
              <div key={c.provider} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{c.provider}</span>
                  <span className="text-xs text-slate-500">
                    Connected {new Date(c.connectedAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{c.note}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Privacy actions */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Actions</h2>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] divide-y divide-white/5">

          {/* Purge email bodies */}
          <ActionRow
            title="Purge stored email bodies"
            description="Deletes any raw email text still in the database. AI summaries are kept. This is normally done automatically."
            buttonLabel="Purge now"
            buttonColor="cyan"
            onConfirm={() => setConfirm("purge")}
          />

          {/* Revoke Google */}
          <ActionRow
            title="Disconnect Google"
            description="Revokes OAuth access and deletes your tokens. Email/calendar sync will stop."
            buttonLabel="Disconnect"
            buttonColor="amber"
            onConfirm={() => setConfirm("revoke")}
          />

          {/* Export */}
          <div className="flex items-center justify-between px-4 py-4 gap-4">
            <div>
              <p className="text-sm font-medium text-white">Export my data</p>
              <p className="text-xs text-slate-500 mt-0.5">Download a JSON file of everything stored — emails metadata, calendar, memory, tasks.</p>
            </div>
            <a
              href="/api/privacy?export=1"
              download
              className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-slate-500/40 text-slate-400 hover:bg-slate-500/10 text-xs font-medium transition-colors"
            >
              Export
            </a>
          </div>

          {/* Delete everything */}
          <ActionRow
            title="Delete all my data"
            description="Permanently erases every record — emails, calendar, memory, tasks, your account. This cannot be undone."
            buttonLabel="Delete everything"
            buttonColor="red"
            onConfirm={() => setConfirm("delete")}
          />
        </div>
      </section>

      {/* Confirm modal */}
      {confirm && (
        <ConfirmModal
          confirm={confirm}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm === "purge") handleAction("purge_bodies");
            if (confirm === "revoke") handleAction("revoke_google");
            if (confirm === "delete") handleAction("delete_all");
          }}
        />
      )}
    </div>
  );
}

function AuditRow({
  label,
  count,
  note,
  children,
}: {
  label: string;
  count: number;
  note?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between px-4 py-3 gap-4">
      <div className="min-w-0">
        <span className="text-sm text-white">{label}</span>
        {note && <p className="text-xs text-slate-500 mt-0.5">{note}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-mono text-cyan-400">{count.toLocaleString()}</span>
        {children}
      </div>
    </div>
  );
}

function ActionRow({
  title,
  description,
  buttonLabel,
  buttonColor,
  onConfirm,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  buttonColor: "cyan" | "amber" | "red";
  onConfirm: () => void;
}) {
  const colors = {
    cyan: "border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10",
    amber: "border-amber-500/40 text-amber-400 hover:bg-amber-500/10",
    red: "border-red-500/40 text-red-400 hover:bg-red-500/10",
  };

  return (
    <div className="flex items-center justify-between px-4 py-4 gap-4">
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <button
        onClick={onConfirm}
        className={`flex-shrink-0 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${colors[buttonColor]}`}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function ConfirmModal({
  confirm,
  busy,
  onCancel,
  onConfirm,
}: {
  confirm: "purge" | "revoke" | "delete";
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const messages = {
    purge: { title: "Purge email bodies?", body: "This will permanently delete any stored raw email text. AI summaries remain.", color: "cyan" },
    revoke: { title: "Disconnect Google?", body: "This revokes OAuth access. Sync will stop and tokens will be deleted.", color: "amber" },
    delete: { title: "Delete all your data?", body: "This permanently erases your account and everything in it. There is no undo.", color: "red" },
  };

  const m = messages[confirm];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 rounded-2xl border border-white/10 bg-[#0d1f35] p-6 shadow-2xl space-y-4">
        <h3 className="text-lg font-semibold text-white">{m.title}</h3>
        <p className="text-sm text-slate-400">{m.body}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-white/10 text-sm text-slate-300 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              m.color === "red"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : m.color === "amber"
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-cyan-600 hover:bg-cyan-700 text-white"
            }`}
          >
            {busy ? "Working…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
