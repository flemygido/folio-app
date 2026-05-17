import { useState, useEffect } from "react";

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const MOCK_BRIEFING = {
  date: "Saturday, May 16 2026",
  generatedAt: "7:02 AM",
  signalScore: 87,
  unread: 142,
  importantCount: 6,
  suppressedCount: 136,
};

const MOCK_EMAILS = [
  {
    id: "e1",
    group: "Urgent · Payment",
    groupIcon: "💰",
    from: "sarah.chen@acmecorp.com",
    fromName: "Sarah Chen · Acme Corp",
    subject: "Invoice #2041 — 14 days overdue",
    snippet: "Hi, just following up on the outstanding invoice. Our finance team needs this resolved before end of month or we'll need to escalate.",
    receivedAt: "Today, 6:48 AM",
    score: 96,
    category: "action",
    whyMatters: "Payment from active client is overdue. Risk of escalation if not addressed today.",
    actionNeeded: "Reply confirming payment timeline or escalate to finance",
    dueDate: "Today",
    status: "new",
    alreadyInformed: false,
    thread: 3,
  },
  {
    id: "e2",
    group: "Deal Progress",
    groupIcon: "🤝",
    from: "marcus@venturebridge.vc",
    fromName: "Marcus Webb · VentureBridge",
    subject: "Term sheet draft — ready for review",
    snippet: "Attaching the revised term sheet. The valuation cap is now aligned with what we discussed. Looking to sign by Friday.",
    receivedAt: "Yesterday, 4:15 PM",
    score: 94,
    category: "action",
    whyMatters: "Active funding round. Term sheet requires your review before deadline Friday.",
    actionNeeded: "Review term sheet and respond with comments or approval",
    dueDate: "Friday, May 22",
    status: "new",
    alreadyInformed: false,
    thread: 2,
  },
  {
    id: "e3",
    group: "Team · Hiring",
    groupIcon: "👥",
    from: "priya.k@yourdomain.com",
    fromName: "Priya K · Head of People",
    subject: "Final interview decision needed — Senior Engineer",
    snippet: "The panel has completed their reviews. We have a strong yes from all three. Offer letter is ready. Candidate has another offer expiring Monday.",
    receivedAt: "Yesterday, 2:30 PM",
    score: 91,
    category: "decision",
    whyMatters: "Candidate will accept competing offer Monday unless you greenlight the hire.",
    actionNeeded: "Approve offer letter",
    dueDate: "Monday, May 18",
    status: "new",
    alreadyInformed: false,
    thread: 1,
  },
  {
    id: "e4",
    group: "Legal",
    groupIcon: "⚖️",
    from: "james@legalfirm.com",
    fromName: "James Okafor · LegalFirm LLP",
    subject: "NDA for TechPartner — signature required",
    snippet: "Please DocuSign the attached NDA before the partnership call on Monday. This is a standard mutual NDA.",
    receivedAt: "May 14, 10:00 AM",
    score: 82,
    category: "action",
    whyMatters: "Required before Monday's partnership call. Low risk — standard mutual NDA.",
    actionNeeded: "Sign NDA via DocuSign",
    dueDate: "Monday, May 18",
    status: "shown",
    alreadyInformed: true,
    thread: 1,
  },
  {
    id: "e5",
    group: "Client · Watch",
    groupIcon: "👁",
    from: "dev@buildco.io",
    fromName: "Dev Patel · BuildCo",
    subject: "Milestone 3 delayed — need call",
    snippet: "We're running about a week behind on milestone 3 due to resourcing. Can we get 30 minutes this week to realign?",
    receivedAt: "May 13, 3:00 PM",
    score: 78,
    category: "watch",
    whyMatters: "Active client flagging delivery delay. May need to adjust expectations or project plan.",
    actionNeeded: "Schedule a call, assess impact on timeline",
    dueDate: "This week",
    status: "new",
    alreadyInformed: false,
    thread: 2,
  },
  {
    id: "e6",
    group: "Partnership",
    groupIcon: "🌐",
    from: "ali@cloudstack.io",
    fromName: "Ali Rahman · CloudStack",
    subject: "Re: Integration partnership — next steps",
    snippet: "Following our call last week, we're aligned on a co-marketing arrangement. I've cc'd our partnerships lead to coordinate.",
    receivedAt: "May 12, 11:45 AM",
    score: 71,
    category: "watch",
    whyMatters: "Partnership momentum. No action needed today but monitor.",
    actionNeeded: "Watch for follow-up from CloudStack partnerships lead",
    dueDate: "None",
    status: "shown",
    alreadyInformed: true,
    thread: 4,
  },
];

const MOCK_CALENDAR = [
  {
    id: "c1",
    title: "Investor Update Call — Series A",
    time: "Monday 10:00–11:00 AM",
    attendees: ["Marcus Webb", "You", "+2"],
    importance: "high",
    prep: "Prepare updated metrics deck. Marcus asked about MRR growth last time.",
    icon: "📊",
  },
  {
    id: "c2",
    title: "Partnership Demo — CloudStack",
    time: "Monday 2:00–3:00 PM",
    attendees: ["Ali Rahman", "You", "+1"],
    importance: "medium",
    prep: "Review integration scope before call.",
    icon: "🌐",
  },
  {
    id: "c3",
    title: "Eng Standup",
    time: "Tuesday 9:30–9:45 AM",
    attendees: ["Priya K", "Team"],
    importance: "low",
    prep: null,
    icon: "⚙️",
  },
  {
    id: "c4",
    title: "1:1 — Priya (People)",
    time: "Wednesday 11:00–11:30 AM",
    attendees: ["Priya K", "You"],
    importance: "medium",
    prep: "Senior engineer offer decision likely needs to come up.",
    icon: "👥",
  },
];

const MOCK_TASKS = [
  { id: "t1", title: "Reply to Sarah Chen re: Invoice #2041", source: "Email", priority: "urgent", due: "Today", done: false },
  { id: "t2", title: "Review VentureBridge term sheet", source: "Email", priority: "urgent", due: "Before Friday", done: false },
  { id: "t3", title: "Approve Senior Engineer offer letter", source: "Email", priority: "high", due: "Before Monday", done: false },
  { id: "t4", title: "Sign NDA for TechPartner (DocuSign)", source: "Email", priority: "high", due: "Before Monday", done: false },
  { id: "t5", title: "Schedule call with Dev Patel — Milestone 3", source: "Email", priority: "medium", due: "This week", done: false },
  { id: "t6", title: "Prepare metrics deck for Monday investor call", source: "Calendar", priority: "high", due: "Sunday", done: false },
];

const MOCK_MEMORY = [
  { id: "m1", type: "contact", key: "VIP", value: "Sarah Chen (Acme Corp) — active paying client", confidence: 0.95, source: "Email pattern", active: true },
  { id: "m2", type: "contact", key: "VIP", value: "Marcus Webb (VentureBridge) — lead investor", confidence: 0.98, source: "Calendar + Email", active: true },
  { id: "m3", type: "priority", key: "active_project", value: "Series A fundraise — in term sheet stage", confidence: 0.92, source: "Email thread", active: true },
  { id: "m4", type: "suppression", key: "ignore", value: "GitHub automated notifications", confidence: 1.0, source: "User feedback", active: true },
  { id: "m5", type: "suppression", key: "ignore", value: "Newsletter: TechCrunch Daily", confidence: 1.0, source: "User feedback", active: true },
  { id: "m6", type: "preference", key: "work_hours", value: "7:00 AM – 8:00 PM", confidence: 0.88, source: "Email send pattern", active: true },
  { id: "m7", type: "priority", key: "active_project", value: "Senior Engineer hiring — final stage", confidence: 0.90, source: "Email thread", active: true },
];

// ─── SCORE BAR ────────────────────────────────────────────────────────────────
function ScoreBar({ score }) {
  const color = score >= 90 ? "#f59e0b" : score >= 75 ? "#fb923c" : "#64748b";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 60, height: 3, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 700, fontFamily: "monospace" }}>{score}</span>
    </div>
  );
}

// ─── BADGE ────────────────────────────────────────────────────────────────────
function Badge({ label, type }) {
  const styles = {
    action: { bg: "#7c2d12", color: "#fed7aa", border: "#9a3412" },
    decision: { bg: "#1e3a5f", color: "#93c5fd", border: "#1d4ed8" },
    watch: { bg: "#1c2a1c", color: "#86efac", border: "#166534" },
    urgent: { bg: "#7c2d12", color: "#fed7aa", border: "#9a3412" },
    high: { bg: "#1e3a5f", color: "#93c5fd", border: "#1d4ed8" },
    medium: { bg: "#1c2a1c", color: "#86efac", border: "#166534" },
    low: { bg: "#1e293b", color: "#94a3b8", border: "#334155" },
    contact: { bg: "#2d1f47", color: "#c4b5fd", border: "#7c3aed" },
    suppression: { bg: "#1e293b", color: "#94a3b8", border: "#334155" },
    preference: { bg: "#1f2937", color: "#a3a3a3", border: "#374151" },
    priority: { bg: "#1e3a5f", color: "#93c5fd", border: "#1d4ed8" },
  };
  const s = styles[type] || styles.low;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      textTransform: "uppercase", letterSpacing: "0.06em"
    }}>{label}</span>
  );
}

// ─── EMAIL CARD ───────────────────────────────────────────────────────────────
function EmailCard({ email, onFeedback }) {
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleFeedback = (type) => {
    setFeedback(type);
    onFeedback(email.id, type);
  };

  if (feedback === "ignore") return null;

  return (
    <div style={{
      background: feedback === "seen" ? "#0f172a" : email.alreadyInformed ? "#0a0f1a" : "#0f172a",
      border: `1px solid ${email.alreadyInformed ? "#1e293b" : email.score >= 90 ? "#78350f" : "#1e293b"}`,
      borderRadius: 10, marginBottom: 10, overflow: "hidden",
      opacity: email.alreadyInformed ? 0.7 : 1,
      transition: "all 0.3s ease",
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ padding: "14px 16px", cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start" }}
      >
        <div style={{ fontSize: 18, marginTop: 1 }}>{email.groupIcon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {email.group}
            </span>
            {email.alreadyInformed && (
              <span style={{ fontSize: 10, color: "#475569", fontWeight: 600 }}>· already informed</span>
            )}
            <ScoreBar score={email.score} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 3, fontFamily: "'Georgia', serif" }}>
            {email.subject}
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            {email.fromName} · {email.receivedAt}
            {email.thread > 1 && <span style={{ marginLeft: 6, color: "#475569" }}>{email.thread} messages</span>}
          </div>
        </div>
        <div style={{ color: "#334155", fontSize: 16, marginTop: 2 }}>{expanded ? "▲" : "▼"}</div>
      </div>

      {/* Snippet always visible */}
      <div style={{ padding: "0 16px 12px 46px", fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>
        {email.snippet}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "0 16px 14px 46px", borderTop: "1px solid #1e293b" }}>
          <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{
              background: "#020b18", border: "1px solid #1e3a5f", borderRadius: 8,
              padding: "10px 12px", fontSize: 12
            }}>
              <div style={{ color: "#f59e0b", fontWeight: 700, marginBottom: 6, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                AI Classification
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <span style={{ color: "#475569" }}>Why it matters: </span>
                  <span style={{ color: "#cbd5e1" }}>{email.whyMatters}</span>
                </div>
                <div>
                  <span style={{ color: "#475569" }}>Action: </span>
                  <span style={{ color: "#93c5fd" }}>{email.actionNeeded}</span>
                </div>
                <div>
                  <span style={{ color: "#475569" }}>Due: </span>
                  <span style={{ color: email.dueDate === "Today" ? "#f59e0b" : "#cbd5e1" }}>{email.dueDate}</span>
                </div>
                <div>
                  <span style={{ color: "#475569" }}>Category: </span>
                  <Badge label={email.category} type={email.category} />
                </div>
              </div>
            </div>

            {/* Feedback buttons */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { key: "important", label: "⭐ Important", color: "#92400e" },
                { key: "seen", label: "✓ Already seen", color: "#1e3a5f" },
                { key: "later", label: "⏰ Remind later", color: "#1c2a1c" },
                { key: "ignore", label: "✗ Ignore", color: "#1e293b" },
              ].map(btn => (
                <button
                  key={btn.key}
                  onClick={() => handleFeedback(btn.key)}
                  style={{
                    fontSize: 11, padding: "5px 10px", borderRadius: 6,
                    background: feedback === btn.key ? btn.color : "transparent",
                    border: `1px solid ${btn.color}`,
                    color: feedback === btn.key ? "#fff" : "#94a3b8",
                    cursor: "pointer", fontWeight: 600, transition: "all 0.2s"
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

// ─── CALENDAR CARD ────────────────────────────────────────────────────────────
function CalendarCard({ event }) {
  return (
    <div style={{
      background: "#0f172a", border: `1px solid ${event.importance === "high" ? "#78350f" : "#1e293b"}`,
      borderRadius: 10, padding: "14px 16px", marginBottom: 8,
      display: "flex", gap: 12, alignItems: "flex-start"
    }}>
      <div style={{ fontSize: 20 }}>{event.icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 3, fontFamily: "'Georgia', serif" }}>
          {event.title}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: event.prep ? 8 : 0 }}>
          {event.time} · {event.attendees.join(", ")}
        </div>
        {event.prep && (
          <div style={{
            fontSize: 12, color: "#93c5fd", background: "#0a1628",
            border: "1px solid #1e3a5f", borderRadius: 6, padding: "6px 10px"
          }}>
            💡 {event.prep}
          </div>
        )}
      </div>
      <Badge label={event.importance} type={event.importance} />
    </div>
  );
}

// ─── TASK ROW ─────────────────────────────────────────────────────────────────
function TaskRow({ task, onToggle }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "11px 14px", borderRadius: 8, marginBottom: 6,
      background: task.done ? "#070d16" : "#0f172a",
      border: "1px solid #1e293b",
      opacity: task.done ? 0.45 : 1, transition: "all 0.2s"
    }}>
      <div
        onClick={() => onToggle(task.id)}
        style={{
          width: 18, height: 18, borderRadius: 4, cursor: "pointer",
          border: task.done ? "2px solid #22c55e" : "2px solid #334155",
          background: task.done ? "#22c55e" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, transition: "all 0.2s"
        }}
      >
        {task.done && <span style={{ color: "#fff", fontSize: 11 }}>✓</span>}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: task.done ? "#475569" : "#e2e8f0", textDecoration: task.done ? "line-through" : "none" }}>
          {task.title}
        </div>
        <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
          from {task.source} · due {task.due}
        </div>
      </div>
      <Badge label={task.priority} type={task.priority} />
    </div>
  );
}

// ─── MEMORY ROW ───────────────────────────────────────────────────────────────
function MemoryRow({ fact, onToggle }) {
  return (
    <div style={{
      display: "flex", gap: 12, padding: "10px 14px", borderRadius: 8,
      background: fact.active ? "#0f172a" : "#070d16",
      border: "1px solid #1e293b", marginBottom: 6,
      opacity: fact.active ? 1 : 0.4
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: "#e2e8f0", marginBottom: 3 }}>{fact.value}</div>
        <div style={{ fontSize: 11, color: "#475569" }}>
          Source: {fact.source} · Confidence: <span style={{ color: "#f59e0b", fontFamily: "monospace" }}>{(fact.confidence * 100).toFixed(0)}%</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
        <Badge label={fact.type} type={fact.type} />
        <button
          onClick={() => onToggle(fact.id)}
          style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 4,
            background: "transparent", border: "1px solid #334155",
            color: "#475569", cursor: "pointer"
          }}
        >
          {fact.active ? "Disable" : "Enable"}
        </button>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function FounderAssistant() {
  const [view, setView] = useState("briefing");
  const [tasks, setTasks] = useState(MOCK_TASKS);
  const [memory, setMemory] = useState(MOCK_MEMORY);
  const [emails, setEmails] = useState(MOCK_EMAILS);
  const [feedbackLog, setFeedbackLog] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);

  const handleFeedback = (id, type) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, userFeedback: type } : e));
    setFeedbackLog(prev => [{ id, type, at: new Date().toLocaleTimeString() }, ...prev]);
  };

  const toggleTask = (id) => setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const toggleMemory = (id) => setMemory(prev => prev.map(m => m.id === id ? { ...m, active: !m.active } : m));

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => { setSyncing(false); setSyncDone(true); setTimeout(() => setSyncDone(false), 3000); }, 2000);
  };

  const navItems = [
    { id: "briefing", label: "Today's Briefing", icon: "📋" },
    { id: "emails", label: "Email Summary", icon: "✉️" },
    { id: "calendar", label: "Calendar", icon: "📅" },
    { id: "tasks", label: "Tasks", icon: "✓" },
    { id: "memory", label: "Memory Vault", icon: "🧠" },
    { id: "audit", label: "Audit Log", icon: "📜" },
  ];

  const doneTasks = tasks.filter(t => t.done).length;
  const urgentTasks = tasks.filter(t => t.priority === "urgent" && !t.done).length;

  return (
    <div style={{
      minHeight: "100vh", background: "#020b18", fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      {/* Google Font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #020b18; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .nav-item:hover { background: #0f172a !important; }
        .card-hover:hover { border-color: #334155 !important; }
      `}</style>

      {/* Top bar */}
      <div style={{
        height: 56, background: "#020b18", borderBottom: "1px solid #0f172a",
        display: "flex", alignItems: "center", padding: "0 24px", gap: 16,
        position: "sticky", top: 0, zIndex: 100
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg, #f59e0b, #d97706)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#020b18"
          }}>F</div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.01em", fontFamily: "'DM Serif Display', serif" }}>
            Folio
          </span>
          <span style={{ fontSize: 11, color: "#334155", fontWeight: 500 }}>AI Founder Assistant</span>
        </div>
        <div style={{ flex: 1 }} />

        {/* Sync status */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {syncing ? (
            <span style={{ fontSize: 11, color: "#f59e0b", animation: "pulse 1s infinite" }}>⟳ Syncing…</span>
          ) : syncDone ? (
            <span style={{ fontSize: 11, color: "#22c55e" }}>✓ Synced</span>
          ) : (
            <span style={{ fontSize: 11, color: "#334155" }}>Last sync: 7:02 AM</span>
          )}
          <button onClick={handleSync} style={{
            fontSize: 11, padding: "5px 12px", borderRadius: 6,
            background: "#0f172a", border: "1px solid #1e293b",
            color: "#94a3b8", cursor: "pointer", fontWeight: 600
          }}>Sync now</button>
        </div>

        {/* User */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: "linear-gradient(135deg, #1d4ed8, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "#fff"
          }}>FL</div>
          <span style={{ fontSize: 12, color: "#64748b" }}>Flemy</span>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1 }}>
        {/* Sidebar */}
        <div style={{
          width: 200, background: "#020b18", borderRight: "1px solid #0f172a",
          padding: "16px 10px", display: "flex", flexDirection: "column", gap: 2,
          position: "sticky", top: 56, height: "calc(100vh - 56px)", overflowY: "auto"
        }}>
          {navItems.map(item => (
            <button
              key={item.id}
              className="nav-item"
              onClick={() => setView(item.id)}
              style={{
                display: "flex", alignItems: "center", gap: 9, padding: "9px 12px",
                borderRadius: 8, background: view === item.id ? "#0f172a" : "transparent",
                border: `1px solid ${view === item.id ? "#1e293b" : "transparent"}`,
                color: view === item.id ? "#e2e8f0" : "#64748b",
                cursor: "pointer", fontSize: 13, fontWeight: view === item.id ? 600 : 400,
                textAlign: "left", transition: "all 0.15s"
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          {/* Connected sources */}
          <div style={{ padding: "12px", borderTop: "1px solid #0f172a", marginTop: 8 }}>
            <div style={{ fontSize: 10, color: "#334155", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Connected
            </div>
            {[
              { label: "Gmail", color: "#22c55e" },
              { label: "Calendar", color: "#22c55e" },
              { label: "Drive", color: "#22c55e" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
                <span style={{ fontSize: 11, color: "#475569" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", maxWidth: 860, animation: "fadeIn 0.3s ease" }}>

          {/* ── BRIEFING ── */}
          {view === "briefing" && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                  Daily Briefing · {MOCK_BRIEFING.date}
                </div>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: "#e2e8f0", fontFamily: "'DM Serif Display', serif", lineHeight: 1.2, marginBottom: 10 }}>
                  Good morning, Flemy.
                </h1>
                <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
                  Your inbox had <span style={{ color: "#e2e8f0" }}>{MOCK_BRIEFING.unread} messages</span> since yesterday.{" "}
                  <span style={{ color: "#f59e0b", fontWeight: 600 }}>{MOCK_BRIEFING.importantCount} actually matter.</span>{" "}
                  {MOCK_BRIEFING.suppressedCount} were suppressed (spam, promos, newsletters).
                </p>
              </div>

              {/* Stats strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
                {[
                  { label: "Signal score", value: MOCK_BRIEFING.signalScore, unit: "/100", color: "#f59e0b" },
                  { label: "Important items", value: MOCK_BRIEFING.importantCount, unit: " today", color: "#fb923c" },
                  { label: "Tasks open", value: tasks.filter(t => !t.done).length, unit: ` (${urgentTasks} urgent)`, color: "#f87171" },
                  { label: "Completed", value: doneTasks, unit: ` of ${tasks.length}`, color: "#22c55e" },
                ].map(s => (
                  <div key={s.label} style={{
                    background: "#0f172a", border: "1px solid #1e293b",
                    borderRadius: 10, padding: "14px 16px"
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: "monospace" }}>
                      {s.value}<span style={{ fontSize: 11, color: "#475569" }}>{s.unit}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Urgent items */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                  🔥 Needs your attention today
                </div>
                {emails.filter(e => e.score >= 90 && !e.alreadyInformed).map(email => (
                  <EmailCard key={email.id} email={email} onFeedback={handleFeedback} />
                ))}
              </div>

              {/* Today's meetings */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: "#93c5fd", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                  📅 Upcoming this week
                </div>
                {MOCK_CALENDAR.filter(e => e.importance !== "low").map(event => (
                  <CalendarCard key={event.id} event={event} />
                ))}
              </div>

              {/* Top tasks */}
              <div>
                <div style={{ fontSize: 12, color: "#86efac", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                  ✓ Tasks extracted from recent activity
                </div>
                {tasks.filter(t => t.priority === "urgent").map(task => (
                  <TaskRow key={task.id} task={task} onToggle={toggleTask} />
                ))}
              </div>
            </div>
          )}

          {/* ── EMAIL SUMMARY ── */}
          {view === "emails" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                  Important emails · Last 10 days
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0", fontFamily: "'DM Serif Display', serif", marginBottom: 8 }}>
                  What happened in your inbox
                </h2>
                <p style={{ fontSize: 13, color: "#64748b" }}>
                  {emails.length} signals surfaced from 142 messages. 136 suppressed (spam/promos/newsletters).
                </p>
              </div>

              {/* Filter bar */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {["All", "Action", "Watch", "Already seen"].map(f => (
                  <button key={f} style={{
                    fontSize: 12, padding: "5px 12px", borderRadius: 20,
                    background: f === "All" ? "#0f172a" : "transparent",
                    border: `1px solid ${f === "All" ? "#f59e0b" : "#1e293b"}`,
                    color: f === "All" ? "#f59e0b" : "#64748b", cursor: "pointer"
                  }}>{f}</button>
                ))}
              </div>

              {emails.map(email => (
                <EmailCard key={email.id} email={email} onFeedback={handleFeedback} />
              ))}
            </div>
          )}

          {/* ── CALENDAR ── */}
          {view === "calendar" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#93c5fd", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                  Calendar · This week
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0", fontFamily: "'DM Serif Display', serif" }}>
                  Upcoming meetings & prep
                </h2>
              </div>
              {MOCK_CALENDAR.map(event => (
                <CalendarCard key={event.id} event={event} />
              ))}
            </div>
          )}

          {/* ── TASKS ── */}
          {view === "tasks" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#86efac", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                  Tasks · AI-extracted
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0", fontFamily: "'DM Serif Display', serif", marginBottom: 6 }}>
                  What needs doing
                </h2>
                <p style={{ fontSize: 13, color: "#64748b" }}>
                  {doneTasks} of {tasks.length} done · {urgentTasks} urgent remaining
                </p>
              </div>
              {["urgent", "high", "medium"].map(level => {
                const levelTasks = tasks.filter(t => t.priority === level);
                if (!levelTasks.length) return null;
                return (
                  <div key={level} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                      {level}
                    </div>
                    {levelTasks.map(task => <TaskRow key={task.id} task={task} onToggle={toggleTask} />)}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── MEMORY ── */}
          {view === "memory" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#c4b5fd", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                  Memory Vault
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0", fontFamily: "'DM Serif Display', serif", marginBottom: 6 }}>
                  What your assistant remembers
                </h2>
                <p style={{ fontSize: 13, color: "#64748b" }}>
                  {memory.filter(m => m.active).length} active facts · click Disable to suppress any
                </p>
              </div>

              {["contact", "priority", "preference", "suppression"].map(type => {
                const typeFacts = memory.filter(m => m.type === type);
                if (!typeFacts.length) return null;
                const labels = { contact: "👤 VIP Contacts", priority: "🎯 Priorities", preference: "⚙️ Preferences", suppression: "🚫 Suppressed" };
                return (
                  <div key={type} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                      {labels[type]}
                    </div>
                    {typeFacts.map(fact => <MemoryRow key={fact.id} fact={fact} onToggle={toggleMemory} />)}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── AUDIT LOG ── */}
          {view === "audit" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                  Audit Log
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0", fontFamily: "'DM Serif Display', serif", marginBottom: 6 }}>
                  What the assistant did
                </h2>
                <p style={{ fontSize: 13, color: "#64748b" }}>Full transparency on every read, summarize, and store action.</p>
              </div>

              {/* System log */}
              {[
                { time: "07:02:14", action: "sync.gmail", detail: "Pulled 142 messages since last cursor", type: "sync" },
                { time: "07:02:19", action: "sync.calendar", detail: "Pulled 4 upcoming events", type: "sync" },
                { time: "07:02:21", action: "sync.drive", detail: "Checked 3 recently modified files", type: "sync" },
                { time: "07:02:28", action: "classify.batch", detail: "Classified 142 emails · 6 important, 136 suppressed", type: "ai" },
                { time: "07:02:35", action: "memory.update", detail: "Updated contact confidence for Sarah Chen (0.91 → 0.95)", type: "memory" },
                { time: "07:02:36", action: "brief.generate", detail: "Daily briefing generated for 2026-05-16", type: "brief" },
                { time: "07:02:40", action: "tasks.extract", detail: "Extracted 6 tasks from important items", type: "task" },
                ...feedbackLog.map((f, i) => ({
                  time: f.at, action: `feedback.${f.type}`, detail: `User marked item ${f.id} as: ${f.type}`, type: "feedback"
                }))
              ].map((entry, i) => {
                const typeColors = { sync: "#3b82f6", ai: "#f59e0b", memory: "#a855f7", brief: "#22c55e", task: "#fb923c", feedback: "#94a3b8" };
                return (
                  <div key={i} style={{
                    display: "flex", gap: 12, padding: "10px 14px", borderRadius: 8,
                    background: "#0f172a", border: "1px solid #1e293b", marginBottom: 6, alignItems: "center"
                  }}>
                    <span style={{ fontSize: 11, color: "#334155", fontFamily: "monospace", flexShrink: 0 }}>{entry.time}</span>
                    <span style={{
                      fontSize: 10, padding: "2px 7px", borderRadius: 4,
                      background: `${typeColors[entry.type]}22`, color: typeColors[entry.type],
                      fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0
                    }}>{entry.type}</span>
                    <span style={{ fontSize: 12, color: "#475569", fontFamily: "monospace" }}>{entry.action}</span>
                    <span style={{ fontSize: 12, color: "#94a3b8", flex: 1 }}>{entry.detail}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
