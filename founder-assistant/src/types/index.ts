// Folio – shared TypeScript types

export type EmailCategory =
  | "urgent"
  | "action_required"
  | "watch"
  | "informational"
  | "newsletter"
  | "promo"
  | "ignore";

export type TaskPriority = "urgent" | "high" | "medium" | "low";
export type TaskStatus = "open" | "done" | "snoozed" | "dismissed";
export type MemoryType = "contact" | "project" | "priority" | "preference" | "suppression" | "context";

// ─── AI CLASSIFICATION RESPONSE ──────────────────────────────────────────────

export interface EmailClassification {
  importance_score: number;       // 0–100
  category: EmailCategory;
  why_important: string;
  short_summary: string;
  action_needed: string | null;
  due_date: string | null;
  confidence: number;             // 0.0–1.0
  already_informed_suggestion: boolean;
}

// ─── AI TASK EXTRACTION ───────────────────────────────────────────────────────

export interface ExtractedTask {
  title: string;
  priority: TaskPriority;
  due_date: string | null;
  source_type: "email" | "calendar";
}

export interface ExtractedReminder {
  text: string;
  send_at_description: string; // "tomorrow morning", "Monday at 9am"
}

export interface TaskExtractionResult {
  tasks: ExtractedTask[];
  reminders: ExtractedReminder[];
}

// ─── AI BRIEFING ─────────────────────────────────────────────────────────────

export interface BriefingResult {
  headline: string;
  narrative: string;    // markdown prose, under 500 words
  signal_score: number;
}

// ─── GOOGLE TOKENS ───────────────────────────────────────────────────────────

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

// ─── SYNC ────────────────────────────────────────────────────────────────────

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  fromName: string | null;
  to: string[];
  snippet: string;
  bodyText: string;
  receivedAt: Date;
  internalDate: bigint;
  labels: string[];
  threadSize: number;
}

export interface CalendarEventRaw {
  googleEventId: string;
  calendarId: string;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  attendees: Array<{ email: string; name: string | null; responseStatus: string }>;
  organizer: { email: string; name: string | null } | null;
  location: string | null;
  meetLink: string | null;
}

// ─── API RESPONSE HELPERS ────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── DASHBOARD TYPES ─────────────────────────────────────────────────────────

export interface DashboardEmail {
  id: string;
  group: string;
  groupIcon: string;
  from: string;
  fromName: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  score: number;
  category: EmailCategory;
  whyMatters: string;
  actionNeeded: string | null;
  dueDate: string | null;
  alreadyInformed: boolean;
  threadSize: number;
}

export interface DashboardTask {
  id: string;
  title: string;
  source: string;
  priority: TaskPriority;
  due: string | null;
  done: boolean;
}

export interface DashboardMemoryFact {
  id: string;
  type: MemoryType;
  key: string;
  value: string;
  confidence: number;
  source: string | null;
  isActive: boolean;
}

export interface DashboardCalendarEvent {
  id: string;
  title: string;
  time: string;
  attendees: string[];
  importance: string;
  prep: string | null;
  icon: string;
}
