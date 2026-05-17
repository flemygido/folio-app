"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ─── QUESTION DEFINITIONS ────────────────────────────────────────────────────

type QuestionType = "text" | "single" | "multi" | "time" | "color" | "avatar";

interface Question {
  id: string;
  question: string;
  subtext?: string;
  type: QuestionType;
  field: string;
  options?: Array<{ value: string; label: string; icon?: string; preview?: string }>;
  placeholder?: string;
  required?: boolean;
}

const QUESTIONS: Question[] = [
  {
    id: "q1",
    question: "What's your name?",
    subtext: "I'll use this to address you personally.",
    type: "text",
    field: "displayName",
    placeholder: "Your first name",
    required: true,
  },
  {
    id: "q2",
    question: "What role best describes you?",
    subtext: "This helps me understand your decision context and email volume.",
    type: "single",
    field: "role",
    options: [
      { value: "ic", label: "Individual Contributor", icon: "💡" },
      { value: "manager", label: "Manager / Team Lead", icon: "👥" },
      { value: "director", label: "Director / VP", icon: "🏗️" },
      { value: "executive", label: "C-Suite / Founder", icon: "🚀" },
    ],
  },
  {
    id: "q3",
    question: "How many emails do you typically get per day?",
    subtext: "I'll calibrate my signal filtering to your volume.",
    type: "single",
    field: "companySize",
    options: [
      { value: "solo", label: "Under 20", icon: "📩" },
      { value: "2-10", label: "20–50", icon: "📬" },
      { value: "11-50", label: "50–150", icon: "📮" },
      { value: "50+", label: "150+ a day", icon: "🌊" },
    ],
  },
  {
    id: "q4",
    question: "What industry are you in?",
    type: "single",
    field: "industry",
    options: [
      { value: "tech", label: "Tech / Software", icon: "💻" },
      { value: "finance", label: "Finance / Banking", icon: "💳" },
      { value: "retail", label: "Retail / E-commerce", icon: "🛍️" },
      { value: "other", label: "Other", icon: "🌐" },
    ],
  },
  {
    id: "q5",
    question: "What are your top 3 priorities right now?",
    subtext: `Be specific — e.g. "Ship Q3 roadmap", "Close partnership deal", "Reduce support tickets"`,
    type: "text",
    field: "topPrioritiesText",
    placeholder: "Type up to 3 priorities, one per line",
  },
  {
    id: "q6",
    question: "Which areas should I monitor most closely?",
    subtext: "Select all that apply.",
    type: "multi",
    field: "priorityDomains",
    options: [
      { value: "revenue", label: "Revenue & Deals", icon: "💰" },
      { value: "team", label: "Team & Hiring", icon: "👥" },
      { value: "finance", label: "Finance & Payments", icon: "📊" },
      { value: "legal", label: "Legal & Compliance", icon: "⚖️" },
      { value: "partnerships", label: "Partnerships", icon: "🤝" },
      { value: "product", label: "Product & Engineering", icon: "🔧" },
    ],
  },
  {
    id: "q7",
    question: "How should I deliver updates?",
    type: "single",
    field: "checkInFrequency",
    options: [
      { value: "urgent_only", label: "Only when urgent", icon: "🔴", preview: "I stay silent unless something needs immediate action." },
      { value: "daily", label: "Daily briefing", icon: "☀️", preview: "Morning summary every day with what matters." },
      { value: "frequent", label: "Check in often", icon: "🔔", preview: "I surface updates as they happen throughout the day." },
    ],
  },
  {
    id: "q8",
    question: "How should I communicate with you?",
    type: "single",
    field: "briefingTone",
    options: [
      { value: "concise", label: "Brief & direct", icon: "⚡", preview: "Get to the point. No fluff." },
      { value: "detailed", label: "Thorough", icon: "📋", preview: "Full context with supporting details." },
      { value: "conversational", label: "Conversational", icon: "💬", preview: "Warm, natural — like a trusted colleague." },
    ],
  },
  {
    id: "q9",
    question: "When do you typically start work?",
    type: "time",
    field: "workHoursStart",
    placeholder: "08:00",
  },
  {
    id: "q10",
    question: "When do you typically end work?",
    type: "time",
    field: "workHoursEnd",
    placeholder: "19:00",
  },
  {
    id: "q11",
    question: "What should I call your assistant?",
    subtext: "Give your AI assistant a name.",
    type: "text",
    field: "assistantName",
    placeholder: "e.g. Aria, Alex, Max",
  },
  {
    id: "q12",
    question: "Choose your assistant's personality.",
    type: "single",
    field: "assistantPersonality",
    options: [
      { value: "CALM_PROFESSIONAL", label: "Calm & Professional", icon: "🎯", preview: "Composed, measured, executive-grade communication." },
      { value: "WARM_SUPPORTIVE", label: "Warm & Supportive", icon: "🌟", preview: "Encouraging, empathetic, like a trusted advisor." },
      { value: "DIRECT_EFFICIENT", label: "Direct & Efficient", icon: "⚡", preview: "Straight to the point. No pleasantries. Results only." },
      { value: "ENERGETIC", label: "Energetic", icon: "🚀", preview: "Upbeat, motivating, brings energy to every briefing." },
    ],
  },
  {
    id: "q13",
    question: "How should your assistant appear?",
    subtext: "Choose the visual style of your assistant.",
    type: "avatar",
    field: "avatarStyle",
    options: [
      { value: "PROFESSIONAL", label: "Professional", icon: "👔" },
      { value: "FRIENDLY", label: "Friendly", icon: "😊" },
      { value: "MINIMAL", label: "Minimal", icon: "⬡" },
    ],
  },
  {
    id: "q14",
    question: "Choose your assistant's gender.",
    type: "single",
    field: "assistantGender",
    options: [
      { value: "FEMALE", label: "Female", icon: "👩" },
      { value: "MALE", label: "Male", icon: "👨" },
      { value: "NEUTRAL", label: "Neutral", icon: "🧑" },
    ],
  },
  {
    id: "q15",
    question: "Choose your accent color.",
    subtext: "This colors your assistant and UI highlights.",
    type: "color",
    field: "avatarColor",
    options: [
      { value: "#f59e0b", label: "Amber" },
      { value: "#3b82f6", label: "Blue" },
      { value: "#8b5cf6", label: "Violet" },
      { value: "#10b981", label: "Emerald" },
      { value: "#f43f5e", label: "Rose" },
      { value: "#06b6d4", label: "Cyan" },
    ],
  },
];

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({
    displayName: "",
    role: "",
    companySize: "",
    industry: "",
    topPrioritiesText: "",
    priorityDomains: [],
    checkInFrequency: "daily",
    briefingTone: "concise",
    workHoursStart: "08:00",
    workHoursEnd: "19:00",
    assistantName: "Aria",
    assistantPersonality: "CALM_PROFESSIONAL",
    avatarStyle: "PROFESSIONAL",
    assistantGender: "FEMALE",
    avatarColor: "#f59e0b",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  const q = QUESTIONS[step];
  const progress = ((step + 1) / QUESTIONS.length) * 100;
  const accentColor = answers.avatarColor ?? "#f59e0b";

  const setValue = (value: any) => setAnswers((prev) => ({ ...prev, [q.field]: value }));

  const toggleMulti = (value: string) => {
    const current: string[] = answers[q.field] ?? [];
    setValue(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  };

  const canAdvance = () => {
    const val = answers[q.field];
    if (!q.required && q.type !== "multi") return true;
    if (q.type === "multi") return (val as string[]).length > 0;
    return Boolean(val);
  };

  const next = () => {
    if (step < QUESTIONS.length - 1) {
      setDirection("forward");
      setStep((s) => s + 1);
    } else {
      handleSubmit();
    }
  };

  const back = () => {
    if (step > 0) {
      setDirection("back");
      setStep((s) => s - 1);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const topPriorities = (answers.topPrioritiesText as string)
        .split("\n")
        .map((s: string) => s.trim())
        .filter(Boolean)
        .slice(0, 3);

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...answers, topPriorities }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setSaveError(err.error ?? "Something went wrong. Please try again.");
        setSaving(false);
        return;
      }

      // Hard navigation so the dashboard layout re-reads session + profile fresh
      window.location.href = "/";
    } catch (e: any) {
      setSaveError(e?.message ?? "Network error. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "#020b18" }}
    >
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-0.5" style={{ background: "#0f172a" }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${progress}%`, background: accentColor }}
        />
      </div>

      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#020b18] font-bold text-sm"
          style={{ background: accentColor }}
        >
          F
        </div>
        <span className="text-sm text-slate-500">Setting up your assistant</span>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-2xl p-8"
        style={{ animation: "fadeIn 0.25s ease" }}
        key={step}
      >
        {/* Step counter */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-[11px] font-mono" style={{ color: accentColor }}>
            {step + 1} / {QUESTIONS.length}
          </span>
          {step > 0 && (
            <button onClick={back} className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors">
              ← Back
            </button>
          )}
        </div>

        {/* Question */}
        <h2
          className="text-xl font-bold text-slate-100 mb-1.5"
          style={{ fontFamily: "var(--font-dm-serif)" }}
        >
          {q.question}
        </h2>
        {q.subtext && <p className="text-sm text-slate-500 mb-6">{q.subtext}</p>}
        {!q.subtext && <div className="mb-6" />}

        {/* Input rendering */}
        {q.type === "text" && (
          <textarea
            value={answers[q.field] ?? ""}
            onChange={(e) => setValue(e.target.value)}
            placeholder={q.placeholder}
            rows={q.field === "topPrioritiesText" ? 3 : 1}
            className="w-full bg-[#020b18] border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors resize-none"
            style={{ borderColor: "inherit" }}
            onFocus={(e) => (e.target.style.borderColor = accentColor)}
            onBlur={(e) => (e.target.style.borderColor = "#334155")}
          />
        )}

        {q.type === "time" && (
          <input
            type="time"
            value={answers[q.field] ?? ""}
            onChange={(e) => setValue(e.target.value)}
            className="bg-[#020b18] border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none transition-colors"
            style={{ colorScheme: "dark" }}
          />
        )}

        {q.type === "single" && (
          <div className="grid grid-cols-2 gap-2.5">
            {q.options?.map((opt) => {
              const selected = answers[q.field] === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setValue(opt.value)}
                  className="text-left rounded-xl p-3.5 border transition-all duration-200"
                  style={{
                    background: selected ? `${accentColor}18` : "#020b18",
                    borderColor: selected ? accentColor : "#1e293b",
                  }}
                >
                  <div className="text-lg mb-1">{opt.icon}</div>
                  <div className="text-sm font-semibold" style={{ color: selected ? accentColor : "#e2e8f0" }}>
                    {opt.label}
                  </div>
                  {opt.preview && (
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{opt.preview}</div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {q.type === "multi" && (
          <div className="grid grid-cols-2 gap-2">
            {q.options?.map((opt) => {
              const selected = (answers[q.field] as string[]).includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleMulti(opt.value)}
                  className="flex items-center gap-2.5 text-left rounded-xl p-3 border transition-all duration-200"
                  style={{
                    background: selected ? `${accentColor}18` : "#020b18",
                    borderColor: selected ? accentColor : "#1e293b",
                  }}
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 text-[10px]"
                    style={{
                      background: selected ? accentColor : "transparent",
                      border: `1.5px solid ${selected ? accentColor : "#334155"}`,
                    }}
                  >
                    {selected && <span className="text-[#020b18] font-bold">✓</span>}
                  </div>
                  <span className="text-sm" style={{ color: selected ? accentColor : "#94a3b8" }}>
                    {opt.icon} {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {q.type === "color" && (
          <div className="flex gap-3 flex-wrap">
            {q.options?.map((opt) => {
              const selected = answers[q.field] === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setValue(opt.value)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div
                    className="w-10 h-10 rounded-full transition-all duration-200"
                    style={{
                      background: opt.value,
                      boxShadow: selected ? `0 0 0 3px ${opt.value}44, 0 0 0 2px ${opt.value}` : "none",
                      transform: selected ? "scale(1.2)" : "scale(1)",
                    }}
                  />
                  <span className="text-[10px] text-slate-600">{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {q.type === "avatar" && (
          <div className="flex gap-4">
            {q.options?.map((opt) => {
              const selected = answers[q.field] === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setValue(opt.value)}
                  className="flex-1 flex flex-col items-center gap-3 rounded-xl p-5 border transition-all"
                  style={{
                    background: selected ? `${accentColor}14` : "#020b18",
                    borderColor: selected ? accentColor : "#1e293b",
                  }}
                >
                  <AvatarPreview
                    style={opt.value as any}
                    gender={answers.assistantGender}
                    color={accentColor}
                    selected={selected}
                  />
                  <span className="text-xs font-semibold" style={{ color: selected ? accentColor : "#64748b" }}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Error */}
        {saveError && (
          <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-400">
            {saveError}
          </div>
        )}

        {/* Next button */}
        <button
          onClick={next}
          disabled={!canAdvance() || saving}
          className="w-full mt-7 py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40"
          style={{
            background: accentColor,
            color: "#020b18",
          }}
        >
          {saving ? "Setting up…" : step === QUESTIONS.length - 1 ? "Launch Folio →" : "Continue →"}
        </button>
      </div>

      {/* Step dots */}
      <div className="flex gap-1.5 mt-6">
        {QUESTIONS.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === step ? 20 : 6,
              height: 6,
              background: i <= step ? accentColor : "#1e293b",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── AVATAR PREVIEW ──────────────────────────────────────────────────────────

function AvatarPreview({
  style,
  gender,
  color,
  selected,
}: {
  style: "PROFESSIONAL" | "FRIENDLY" | "MINIMAL";
  gender: string;
  color: string;
  selected: boolean;
}) {
  if (style === "MINIMAL") {
    return (
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center text-xl"
        style={{ background: `${color}22`, border: `2px solid ${color}44` }}
      >
        <div
          className="w-8 h-8 rounded-full"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}88)` }}
        />
      </div>
    );
  }

  if (style === "PROFESSIONAL") {
    return (
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
        style={{ background: `linear-gradient(135deg, ${color}33, ${color}11)`, border: `2px solid ${color}44` }}
      >
        {gender === "FEMALE" ? "👩‍💼" : gender === "MALE" ? "👨‍💼" : "🧑‍💼"}
      </div>
    );
  }

  return (
    <div
      className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
      style={{ background: `linear-gradient(135deg, ${color}22, ${color}11)`, border: `2px solid ${color}33` }}
    >
      {gender === "FEMALE" ? "👩" : gender === "MALE" ? "👨" : "🧑"}
    </div>
  );
}
