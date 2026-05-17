import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

export const EmailClassificationSchema = z.object({
  importance_score: z.number().int().min(0).max(100),
  category: z.enum(["urgent", "action_required", "watch", "informational", "newsletter", "promo", "ignore"]),
  why_important: z.string(),
  short_summary: z.string(),
  action_needed: z.string().nullable(),
  due_date: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  already_informed_suggestion: z.boolean(),
});

export const TaskExtractionSchema = z.object({
  tasks: z.array(z.object({
    title: z.string(),
    priority: z.enum(["urgent", "high", "medium", "low"]),
    due_date: z.string().nullable(),
    source_type: z.enum(["email", "calendar"]),
  })),
  reminders: z.array(z.object({
    text: z.string(),
    send_at_description: z.string(),
  })),
});

export const BriefingSchema = z.object({
  headline: z.string().max(120),
  narrative: z.string(),
  signal_score: z.number().int().min(0).max(100),
});

// ─── EMAIL CLASSIFICATION ─────────────────────────────────────────────────────

export async function classifyEmail(params: {
  subject: string;
  from: string;
  snippet: string;
  bodyText: string;
  memoryContext: string;
  alreadyInformedIds: string[];
}): Promise<z.infer<typeof EmailClassificationSchema>> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are Folio, an AI work assistant helping a professional manage their inbox.
Your job is to classify emails by importance to THIS person's work. Suppress noise ruthlessly.

Memory context about this user:
${params.memoryContext}

Already informed items (do not re-surface): ${params.alreadyInformedIds.join(", ") || "none"}

Scoring guide:
- 90–100: Urgent. Needs action TODAY — deadline, escalation, payment, key decision, manager/client request.
- 75–89:  Action required. Deadline-driven, important sender, needs a response soon.
- 60–74:  Watch. Relevant update the user should see, no immediate action needed.
- 40–59:  Informational. Interesting context, low urgency.
- 0–39:   Noise. Newsletter, promo, automated notification, CC'd without need for action.

Be ruthlessly signal-focused. Most emails score under 40. Calibrate to this person's role and priorities.`,
      },
      {
        role: "user",
        content: `Classify this email:

FROM: ${params.from}
SUBJECT: ${params.subject}
SNIPPET: ${params.snippet}
BODY (first 800 chars): ${params.bodyText.slice(0, 800)}`,
      },
    ],
    response_format: zodResponseFormat(EmailClassificationSchema, "email_classification"),
  });

  return EmailClassificationSchema.parse(
    JSON.parse(response.choices[0].message.content!)
  );
}

// ─── TASK EXTRACTION ──────────────────────────────────────────────────────────

export async function extractTasks(params: {
  emails: Array<{ subject: string; from: string; summary: string; dueDate: string | null }>;
}): Promise<z.infer<typeof TaskExtractionSchema>> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are Folio. Extract concrete action items and reminders from email summaries.
Only extract tasks that require explicit action from this person. Skip vague items and FYI-only emails.
Format tasks as short, actionable to-dos.`,
      },
      {
        role: "user",
        content: `Extract tasks from these important emails:\n\n${params.emails
          .map((e, i) => `${i + 1}. [${e.from}] ${e.subject}\n   Summary: ${e.summary}\n   Due: ${e.dueDate ?? "none"}`)
          .join("\n\n")}`,
      },
    ],
    response_format: zodResponseFormat(TaskExtractionSchema, "task_extraction"),
  });

  return TaskExtractionSchema.parse(JSON.parse(response.choices[0].message.content!));
}

// ─── BRIEFING GENERATION ──────────────────────────────────────────────────────

export async function generateBriefing(params: {
  date: string;
  importantEmails: Array<{ subject: string; from: string; summary: string; category: string }>;
  upcomingEvents: Array<{ title: string; time: string; prepNote: string | null }>;
  openTasks: number;
  urgentTasks: number;
  memoryContext: string;
}): Promise<z.infer<typeof BriefingSchema>> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are Folio, a calm AI work assistant. Write a daily briefing for a professional.

Tone: calm, intelligent, focused. Like a trusted chief of staff.
Format: short prose, no bullet spam, markdown allowed.
Length: under 400 words. The reader finishes this in under 3 minutes.

Context about this person:
${params.memoryContext}`,
      },
      {
        role: "user",
        content: `Write today's briefing for ${params.date}.

Important emails:
${params.importantEmails.map((e) => `- [${e.category}] ${e.from}: ${e.subject} — ${e.summary}`).join("\n")}

Upcoming meetings:
${params.upcomingEvents.map((e) => `- ${e.title} at ${e.time}${e.prepNote ? ` (prep: ${e.prepNote})` : ""}`).join("\n")}

Open tasks: ${params.openTasks} (${params.urgentTasks} urgent)`,
      },
    ],
    response_format: zodResponseFormat(BriefingSchema, "daily_briefing"),
  });

  return BriefingSchema.parse(JSON.parse(response.choices[0].message.content!));
}
