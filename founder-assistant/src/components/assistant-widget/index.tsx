"use client";

/**
 * Floating Assistant Widget
 *
 * - Fixed overlay on screen edge (corner-snapping)
 * - Draggable to any corner
 * - Click → chat panel slides in from that corner (peek-a-boo)
 * - Animated SVG avatar with state: idle | alert | thinking | greeting
 * - Persists position in localStorage
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { AssistantAvatar, type AvatarState } from "./avatar";
import { ChatPanel } from "./chat-panel";

type Corner = "bottom-right" | "bottom-left" | "top-right" | "top-left";

interface WidgetConfig {
  assistantName: string;
  avatarStyle: "PROFESSIONAL" | "FRIENDLY" | "MINIMAL";
  assistantGender: "FEMALE" | "MALE" | "NEUTRAL";
  avatarColor: string;
  personality: string;
}

interface Alert {
  id: string;
  type: string;
  urgency: string;
  title: string;
  body: string;
  isRead: boolean;
}

interface AssistantWidgetProps {
  config: WidgetConfig;
  alerts: Alert[];
}

const CORNER_STYLES: Record<Corner, React.CSSProperties> = {
  "bottom-right": { bottom: 24, right: 24 },
  "bottom-left": { bottom: 24, left: 24 },
  "top-right": { top: 80, right: 24 },
  "top-left": { top: 80, left: 24 },
};

const PANEL_ORIGIN: Record<Corner, React.CSSProperties> = {
  "bottom-right": { bottom: 84, right: 0, transformOrigin: "bottom right" },
  "bottom-left": { bottom: 84, left: 0, transformOrigin: "bottom left" },
  "top-right": { top: 84, right: 0, transformOrigin: "top right" },
  "top-left": { top: 84, left: 0, transformOrigin: "top left" },
};

export function AssistantWidget({ config, alerts: initialAlerts }: AssistantWidgetProps) {
  const [corner, setCorner] = useState<Corner>(() => {
    if (typeof window === "undefined") return "bottom-right";
    return (localStorage.getItem("folio_widget_corner") as Corner) ?? "bottom-right";
  });
  const [open, setOpen] = useState(false);
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [hasGreeted, setHasGreeted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [chatMessages, setChatMessages] = useState<Array<{id: string; role: "assistant" | "user"; content: string; at: Date}>>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("folio_chat_history");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [{
      id: "welcome",
      role: "assistant" as const,
      content: alerts.length > 0
        ? `Hi! I found ${alerts.length} thing${alerts.length > 1 ? "s" : ""} that need${alerts.length === 1 ? "s" : ""} your attention. How can I help?`
        : "Hi! Everything looks calm right now. How can I help?",
      at: new Date(),
    }];
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);

  // Persist chat history across sessions
  useEffect(() => {
    try { localStorage.setItem("folio_chat_history", JSON.stringify(chatMessages.slice(-30))); } catch {}
  }, [chatMessages]);

  // Tell Electron to capture or pass through mouse events
  const setInteractive = () => (window as any).folioDesktop?.setInteractive?.();
  const setPassthrough = () => (window as any).folioDesktop?.setPassthrough?.();

  const unreadCount = alerts.filter((a) => !a.isRead).length;

  // Mark all unread alerts as read when chat opens
  useEffect(() => {
    if (!open) return;
    const unread = alerts.filter((a) => !a.isRead);
    if (unread.length === 0) return;
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
    unread.forEach((a) => {
      fetch("/api/alerts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id, action: "read" }) }).catch(() => {});
    });
  }, [open]);

  // Greet on first open
  useEffect(() => {
    if (open && !hasGreeted) {
      setAvatarState("greeting");
      setHasGreeted(true);
      setTimeout(() => setAvatarState(unreadCount > 0 ? "alert" : "idle"), 1200);
    }
    if (!open) {
      setAvatarState(unreadCount > 0 ? "alert" : "idle");
    }
  }, [open]);

  // Alert pulse when there are unread alerts
  useEffect(() => {
    if (unreadCount > 0 && !open) {
      setAvatarState("alert");
    }
  }, [unreadCount, open]);

  // ─── DRAG ────────────────────────────────────────────────────────────────

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    hasDragged.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };

    const onMouseMove = (ev: MouseEvent) => {
      const dx = Math.abs(ev.clientX - dragStartPos.current.x);
      const dy = Math.abs(ev.clientY - dragStartPos.current.y);
      if (dx > 8 || dy > 8) hasDragged.current = true;
    };

    const onMouseUp = (ev: MouseEvent) => {
      setIsDragging(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      if (!hasDragged.current) return; // was a click, not drag

      // Determine nearest corner based on drop position
      const { clientX, clientY } = ev;
      const { innerWidth, innerHeight } = window;
      const isRight = clientX > innerWidth / 2;
      const isBottom = clientY > innerHeight / 2;
      const newCorner: Corner = `${isBottom ? "bottom" : "top"}-${isRight ? "right" : "left"}`;
      setCorner(newCorner);
      localStorage.setItem("folio_widget_corner", newCorner);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  const handleClick = () => {
    if (hasDragged.current) return; // ignore drag-end as click
    setOpen((v) => !v);
  };

  const { color } = { color: config.avatarColor };

  return (
    <div
      ref={containerRef}
      className="fixed z-[9999] select-none"
      style={CORNER_STYLES[corner]}
      onMouseEnter={setInteractive}
      onMouseLeave={setPassthrough}
    >
      {/* Chat panel */}
      {open && (
        <div
          className="absolute"
          style={{
            ...PANEL_ORIGIN[corner],
            animation: "widgetOpen 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
          }}
        >
          <ChatPanel
            assistantName={config.assistantName}
            color={config.avatarColor}
            alerts={alerts}
            messages={chatMessages}
            setMessages={setChatMessages}
            onClose={() => setOpen(false)}
            onStateChange={setAvatarState}
          />
        </div>
      )}

      {/* Avatar button */}
      <div
        onMouseDown={onMouseDown}
        onClick={handleClick}
        className="relative cursor-pointer"
        style={{
          filter: isDragging ? "opacity(0.8)" : "none",
          transition: "filter 0.2s",
        }}
      >
        {/* Avatar */}
        <div
          className="rounded-full overflow-hidden"
          style={{
            boxShadow: `0 8px 32px ${config.avatarColor}44, 0 2px 8px rgba(0,0,0,0.6)`,
            animation: avatarState === "alert" && !open ? "glowPulse 1.6s ease-in-out infinite" : "none",
            transition: "transform 0.2s",
            transform: open ? "scale(1.05)" : "scale(1)",
          }}
        >
          <AssistantAvatar
            style={config.avatarStyle}
            gender={config.assistantGender}
            color={config.avatarColor}
            state={avatarState}
            size={56}
            name={config.assistantName}
          />
        </div>

        {/* Unread badge */}
        {unreadCount > 0 && !open && (
          <div
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ background: "#ef4444", boxShadow: "0 2px 6px rgba(239,68,68,0.6)" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </div>
        )}

        {/* Drag hint on hover */}
        <div
          className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-slate-600 whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity pointer-events-none"
        >
          drag to move
        </div>
      </div>

      {/* Widget CSS animations */}
      <style>{`
        @keyframes floatY {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes glowPulse {
          0%, 100% { filter: brightness(1) saturate(1); }
          50% { filter: brightness(1.35) saturate(1.3); }
        }
        @keyframes widgetOpen {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes waveArm {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-15deg); }
          75% { transform: rotate(15deg); }
        }
      `}</style>
    </div>
  );
}
