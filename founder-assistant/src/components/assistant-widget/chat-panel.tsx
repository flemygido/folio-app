"use client";

import { useState, useRef, useEffect } from "react";
import type { AvatarState } from "./avatar";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  at: Date;
}

interface Alert {
  id: string;
  type: string;
  urgency: string;
  title: string;
  body: string;
  isRead: boolean;
}

interface ChatPanelProps {
  assistantName: string;
  color: string;
  alerts: Alert[];
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onClose: () => void;
  onStateChange: (state: AvatarState) => void;
}

export function ChatPanel({ assistantName, color, alerts, messages, setMessages, onClose, onStateChange }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text, at: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    onStateChange("thinking");

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages.slice(-6) }),
      });
      const data = await res.json();
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.data?.reply ?? "I couldn't process that. Try again.",
        at: new Date(),
      };
      setMessages((prev) => [...prev, reply]);
      onStateChange("idle");
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "assistant", content: "Something went wrong. Please try again.", at: new Date() },
      ]);
      onStateChange("idle");
    } finally {
      setLoading(false);
    }
  };

  const QUICK_ACTIONS = [
    "What needs my attention today?",
    "Summarize my inbox",
    "Any calendar conflicts?",
    "What tasks are overdue?",
  ];

  const unreadAlerts = alerts.filter((a) => !a.isRead);

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden"
      style={{
        width: 340,
        maxHeight: 520,
        background: "#0d1929",
        border: `1px solid ${color}33`,
        boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px ${color}22`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${color}22, ${color}11)`, borderBottom: `1px solid ${color}22` }}
      >
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-100">{assistantName}</div>
          <div className="text-[10px] flex items-center gap-1" style={{ color: `${color}cc` }}>
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Active · AI Assistant
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all text-xs"
        >
          ✕
        </button>
      </div>

      {/* Smart Alerts strip */}
      {unreadAlerts.length > 0 && (
        <div
          className="px-3 py-2 flex-shrink-0 overflow-x-auto flex gap-2"
          style={{ borderBottom: `1px solid ${color}15` }}
        >
          {unreadAlerts.slice(0, 3).map((alert) => (
            <div
              key={alert.id}
              className="flex-shrink-0 rounded-lg px-3 py-2 text-[11px] cursor-pointer max-w-[200px]"
              style={{
                background: alert.urgency === "CRITICAL" || alert.urgency === "HIGH" ? "#7c2d1222" : "#1c2a1c",
                border: `1px solid ${alert.urgency === "CRITICAL" || alert.urgency === "HIGH" ? "#9a3412" : "#166534"}`,
              }}
              onClick={() => sendMessage(`Tell me about: ${alert.title}`)}
            >
              <div
                className="font-semibold truncate"
                style={{ color: alert.urgency === "CRITICAL" ? "#f87171" : "#86efac" }}
              >
                {alert.type === "ABSENCE_CONFLICT" ? "📅" : alert.type === "DEADLINE_RISK" ? "⏰" : "⚠️"}{" "}
                {alert.title}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed"
              style={
                msg.role === "assistant"
                  ? { background: "#1e293b", color: "#e2e8f0" }
                  : { background: color, color: "#020b18" }
              }
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#1e293b] rounded-xl px-4 py-3 flex gap-1 items-center">
              {[0, 0.15, 0.3].map((d) => (
                <div
                  key={d}
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ background: color, animationDelay: `${d}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      {messages.length === 1 && !loading && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action}
              onClick={() => sendMessage(action)}
              className="text-[11px] px-2.5 py-1 rounded-full border transition-all hover:opacity-80"
              style={{ borderColor: `${color}44`, color: `${color}cc`, background: `${color}11` }}
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div
        className="flex items-center gap-2 px-3 py-3 flex-shrink-0"
        style={{ borderTop: `1px solid ${color}15` }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
          placeholder={`Ask ${assistantName}…`}
          disabled={loading}
          className="flex-1 bg-[#1e293b] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all disabled:opacity-30"
          style={{ background: color, color: "#020b18" }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
