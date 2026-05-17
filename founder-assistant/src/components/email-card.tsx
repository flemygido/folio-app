"use client";

import { useState } from "react";
import { ScoreBar } from "./score-bar";
import type { DashboardEmail } from "@/types";

const CATEGORY_ICONS: Record<string, string> = {
  URGENT: "🔴",
  ACTION_REQUIRED: "🟠",
  WATCH: "👁",
  INFORMATIONAL: "ℹ️",
  NEWSLETTER: "📰",
  PROMO: "🏷️",
  IGNORE: "—",
};

interface EmailCardProps {
  email: DashboardEmail;
  onFeedback?: (id: string, type: string) => void;
}

export function EmailCard({ email, onFeedback }: EmailCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftCopied, setDraftCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleFeedback = async (type: string) => {
    setFeedback(type);
    onFeedback?.(email.id, type);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: email.id, type }),
      });
    } catch { /* non-blocking */ }
  };

  const handleAction = async (action: "archive" | "mark-handled") => {
    setActionLoading(action);
    try {
      await fetch(`/api/emails/${email.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (action === "archive") setFeedback("ignore");
      if (action === "mark-handled") setFeedback("seen");
    } catch { /* non-blocking */ }
    setActionLoading(null);
  };

  const handleDraftReply = async () => {
    if (draft) { setDraft(null); return; }
    setDraftLoading(true);
    try {
      const res = await fetch(`/api/emails/${email.id}/draft-reply`, { method: "POST" });
      const data = await res.json();
      if (data.success) setDraft(data.data.draft);
    } catch { /* non-blocking */ }
    setDraftLoading(false);
  };

  const handleCopyDraft = async () => {
    if (!draft) return;
    await navigator.clipboard.writeText(draft);
    setDraftCopied(true);
    setTimeout(() => setDraftCopied(false), 2000);
  };

  if (feedback === "ignore") return null;

  const isHighPriority = email.score >= 90;
  const cat = email.category.toUpperCase();

  return (
    <div
      className="rounded-xl mb-2.5 overflow-hidden transition-all duration-300"
      style={{
        background: email.alreadyInformed ? "#0a0f1a" : "#0f172a",
        border: `1px solid ${isHighPriority && !email.alreadyInformed ? "#78350f" : "#1e293b"}`,
        opacity: email.alreadyInformed ? 0.7 : 1,
      }}
    >
      {/* Header row */}
      <div
        className="px-4 py-3.5 cursor-pointer flex gap-3 items-start"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="text-lg mt-0.5">{email.groupIcon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[11px] text-amber-400 font-bold uppercase tracking-widest">
              {email.group}
            </span>
            {email.alreadyInformed && (
              <span className="text-[10px] text-slate-600 font-semibold">· handled</span>
            )}
            <ScoreBar score={email.score} />
          </div>
          <div className="text-sm font-semibold text-slate-200 mb-0.5" style={{ fontFamily: "var(--font-dm-serif)" }}>
            {email.subject}
          </div>
          <div className="text-xs text-slate-500">
            {email.fromName} · {email.receivedAt}
            {email.threadSize > 1 && (
              <span className="ml-1.5 text-slate-600">{email.threadSize} messages</span>
            )}
          </div>
        </div>
        <div className="text-slate-700 text-base mt-0.5">{expanded ? "▲" : "▼"}</div>
      </div>

      {/* Snippet */}
      <div className="px-4 pb-3 pl-11 text-[13px] text-slate-400 leading-relaxed">
        {email.snippet}
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="px-4 pb-3.5 pl-11 border-t border-slate-800">
          <div className="pt-3 space-y-2.5">
            {/* AI Classification box */}
            <div className="bg-[#020b18] border border-[#1e3a5f] rounded-lg p-3 text-xs">
              <div className="text-amber-400 font-bold mb-2 text-[10px] uppercase tracking-widest">
                AI Classification
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-600">Why it matters: </span>
                  <span className="text-slate-300">{email.whyMatters}</span>
                </div>
                <div>
                  <span className="text-slate-600">Action: </span>
                  <span className="text-blue-300">{email.actionNeeded ?? "None"}</span>
                </div>
                <div>
                  <span className="text-slate-600">Due: </span>
                  <span className={email.dueDate === "Today" ? "text-amber-400" : "text-slate-300"}>
                    {email.dueDate ?? "None"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600">Category: </span>
                  <span className="text-slate-300">{cat}</span>
                </div>
              </div>
            </div>

            {/* Primary actions */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleDraftReply}
                disabled={draftLoading}
                className="text-[11px] px-2.5 py-1 rounded-md font-semibold border transition-all duration-200 disabled:opacity-40"
                style={{
                  background: draft ? "#1e3a5f" : "transparent",
                  borderColor: "#1e3a5f",
                  color: draft ? "#93c5fd" : "#94a3b8",
                }}
              >
                {draftLoading ? "Drafting…" : draft ? "Hide draft" : "✍ Draft reply"}
              </button>
              <button
                onClick={() => handleAction("mark-handled")}
                disabled={actionLoading === "mark-handled" || feedback === "seen"}
                className="text-[11px] px-2.5 py-1 rounded-md font-semibold border transition-all duration-200 disabled:opacity-40"
                style={{
                  background: feedback === "seen" ? "#1e3a5f" : "transparent",
                  borderColor: "#1e3a5f",
                  color: feedback === "seen" ? "#fff" : "#94a3b8",
                }}
              >
                {actionLoading === "mark-handled" ? "…" : "✓ Handled"}
              </button>
              <button
                onClick={() => handleAction("archive")}
                disabled={actionLoading === "archive"}
                className="text-[11px] px-2.5 py-1 rounded-md font-semibold border transition-all duration-200 disabled:opacity-40"
                style={{ borderColor: "#334155", color: "#64748b" }}
              >
                {actionLoading === "archive" ? "…" : "Archive"}
              </button>
            </div>

            {/* AI Draft Reply */}
            {draft && (
              <div className="bg-[#020b18] border border-[#1e3a5f] rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-blue-300 font-bold uppercase tracking-widest">
                    AI Draft Reply
                  </span>
                  <button
                    onClick={handleCopyDraft}
                    className="text-[10px] px-2 py-0.5 rounded border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-all"
                  >
                    {draftCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <pre className="text-[12px] text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                  {draft}
                </pre>
                <div className="mt-2 text-[10px] text-slate-600">
                  Review before sending. Paste into Gmail to send.
                </div>
              </div>
            )}

            {/* Legacy feedback buttons */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: "important", label: "⭐ Important", activeColor: "#92400e" },
                { key: "later", label: "⏰ Later", activeColor: "#1c2a1c" },
              ].map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => handleFeedback(btn.key)}
                  className="text-[11px] px-2.5 py-1 rounded-md font-semibold border transition-all duration-200"
                  style={{
                    background: feedback === btn.key ? btn.activeColor : "transparent",
                    borderColor: btn.activeColor,
                    color: feedback === btn.key ? "#fff" : "#94a3b8",
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
