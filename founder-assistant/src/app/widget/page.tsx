"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signIn } from "next-auth/react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Alert {
  type: string;
  title: string;
  body: string;
  urgency: string;
}

export default function WidgetPage() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [tab, setTab] = useState<"chat" | "alerts">("chat");
  const [syncing, setSyncing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session) fetchAlerts();
  }, [session]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchAlerts() {
    try {
      const res = await fetch("/api/alerts");
      const data = await res.json();
      if (data.success) setAlerts(data.data ?? []);
    } catch {}
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const history = messages.slice(-6);
    setMessages((m) => [...m, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, history }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.data?.reply ?? "Something went wrong." }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Connection error." }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/sync/gmail", { method: "POST" });
      await fetchAlerts();
    } finally {
      setSyncing(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="w-full h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="w-full h-screen bg-[#0a0f1e] flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-[#0a0f1e] font-bold text-xl">F</div>
        <p className="text-slate-400 text-sm text-center">Sign in to use Folio assistant</p>
        <button
          onClick={() => signIn("google")}
          className="w-full bg-white text-gray-800 font-semibold text-sm py-2.5 px-4 rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-[#0a0f1e] flex flex-col overflow-hidden select-none" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#0f172a] border-b border-slate-800 drag-region" style={{ WebkitAppRegion: "drag" } as any}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-[#0a0f1e] font-bold text-xs">F</div>
          <span className="text-slate-300 text-xs font-semibold">Folio</span>
          {alerts.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{alerts.length}</span>
          )}
        </div>
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as any}>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1 rounded hover:bg-slate-800 transition-all"
            title="Sync now"
          >
            {syncing ? "⟳" : "↺"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        {(["chat", "alerts"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 text-xs py-2 font-medium transition-all ${
              tab === t ? "text-amber-400 border-b-2 border-amber-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t === "chat" ? "Aria" : `Alerts${alerts.length ? ` (${alerts.length})` : ""}`}
          </button>
        ))}
      </div>

      {/* Chat tab */}
      {tab === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
            {messages.length === 0 && (
              <div className="text-center mt-8">
                <div className="text-2xl mb-2">👋</div>
                <p className="text-slate-400 text-xs">Hi {session.user?.name?.split(" ")[0]}! Ask me anything about your inbox.</p>
                <div className="mt-4 space-y-2">
                  {["What needs my attention today?", "Any urgent emails?", "Summarize my inbox"].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); }}
                      className="block w-full text-left text-xs text-slate-400 bg-slate-800/50 hover:bg-slate-700/50 px-3 py-2 rounded-lg transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] text-xs px-3 py-2 rounded-xl leading-relaxed ${
                    msg.role === "user"
                      ? "bg-amber-500 text-[#0a0f1e] font-medium"
                      : "bg-slate-800 text-slate-200"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 px-3 py-2 rounded-xl">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2 border-t border-slate-800 bg-[#0f172a]">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask Aria..."
                className="flex-1 bg-slate-800 text-slate-200 text-xs px-3 py-2 rounded-lg outline-none placeholder-slate-500 focus:ring-1 focus:ring-amber-500/50"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-[#0a0f1e] px-3 py-2 rounded-lg transition-all"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Alerts tab */}
      {tab === "alerts" && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {alerts.length === 0 ? (
            <div className="text-center mt-8 text-slate-500 text-xs">No active alerts</div>
          ) : (
            alerts.map((alert, i) => (
              <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${
                    alert.urgency === "CRITICAL" ? "bg-red-500/20 text-red-400" :
                    alert.urgency === "HIGH" ? "bg-orange-500/20 text-orange-400" :
                    "bg-slate-700 text-slate-400"
                  }`}>{alert.urgency}</span>
                  <div>
                    <p className="text-slate-200 text-xs font-medium leading-tight">{alert.title}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">{alert.body}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
