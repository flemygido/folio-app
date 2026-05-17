"use client";

import { useState } from "react";
import type { User } from "next-auth";

interface TopBarProps {
  user: User;
  lastSyncedAt?: Date | null;
}

function formatLastSync(date: Date | null | undefined): string {
  if (!date) return "never";
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function TopBar({ user, lastSyncedAt }: TopBarProps) {
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [syncDetail, setSyncDetail] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncState("syncing");
    setSyncDetail(null);
    try {
      const res = await fetch("/api/sync/gmail", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const g = data.data?.gmail;
        const c = data.data?.calendar;
        const gmailErr = g?.error;
        const calErr = c?.error;
        if (gmailErr) {
          setSyncDetail(`Gmail error: ${gmailErr}`);
          setSyncState("error");
          setTimeout(() => setSyncState("idle"), 8000);
        } else {
          const emailCount = g?.synced ?? 0;
          const calCount = c?.synced ?? 0;
          setSyncDetail(`${emailCount} emails · ${calCount} events`);
          setSyncState("done");
          setTimeout(() => { window.location.reload(); }, 2000);
        }
      } else {
        setSyncDetail(data.error ?? "Unknown error");
        setSyncState("error");
        setTimeout(() => setSyncState("idle"), 8000);
      }
    } catch (e: any) {
      setSyncDetail(e?.message ?? "Network error");
      setSyncState("error");
      setTimeout(() => setSyncState("idle"), 8000);
    }
  };

  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="h-14 bg-[#020b18] border-b border-[#0f172a] flex items-center px-6 gap-4 sticky top-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-[#020b18] font-bold text-sm">
          F
        </div>
        <span
          className="text-[15px] font-bold text-slate-100 tracking-tight"
          style={{ fontFamily: "var(--font-dm-serif)" }}
        >
          Folio
        </span>
        <span className="text-[11px] text-slate-700 font-medium">AI Work Assistant</span>
      </div>

      <div className="flex-1" />

      {/* Sync status */}
      <div className="flex items-center gap-2">
        {syncState === "syncing" ? (
          <span className="text-[11px] text-amber-400 animate-pulse-slow">⟳ Syncing Gmail + Calendar…</span>
        ) : syncState === "done" ? (
          <span className="text-[11px] text-green-400">✓ {syncDetail ?? "Synced"} · reloading…</span>
        ) : syncState === "error" ? (
          <span className="text-[11px] text-red-400 max-w-[300px] truncate" title={syncDetail ?? ""}>✗ {syncDetail ?? "Sync failed"}</span>
        ) : lastSyncedAt ? (
          <span className="text-[11px] text-slate-700">Last synced {formatLastSync(lastSyncedAt)}</span>
        ) : null}
        <button
          onClick={handleSync}
          disabled={syncState === "syncing"}
          className="text-[11px] px-3 py-1 rounded-md bg-[#0f172a] border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {syncState === "syncing" ? "Syncing…" : "Sync now"}
        </button>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
          {initials}
        </div>
        <span className="text-xs text-slate-500">{user.name?.split(" ")[0] ?? "You"}</span>
      </div>
    </header>
  );
}
