/**
 * Calendar Intelligence Service
 *
 * Cross-references email content with calendar events to generate smart alerts.
 *
 * Example:
 *   Email: "Priya will be on leave Mon–Tue"
 *   → Finds: Product Review (Mon 4pm, Priya attending)
 *   → Alert: "Priya on leave. She's in Product Review today at 4pm."
 *
 * Detects:
 * - Absence / leave notifications → calendar conflict check
 * - Meeting reschedule emails → calendar update needed
 * - Deadline mentions → task + reminder creation
 */

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { db } from "@/lib/db";
import { format, parseISO, addDays, startOfDay, endOfDay } from "date-fns";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

const AbsenceDetectionSchema = z.object({
  absence_detected: z.boolean(),
  person_name: z.string().nullable(),
  person_email: z.string().nullable(),
  start_date: z.string().nullable(),  // YYYY-MM-DD
  end_date: z.string().nullable(),    // YYYY-MM-DD
  reason: z.string().nullable(),
  meeting_reschedule_detected: z.boolean(),
  deadline_detected: z.boolean(),
  deadline_date: z.string().nullable(),
  deadline_description: z.string().nullable(),
});

// ─── MAIN ENTRY POINT ────────────────────────────────────────────────────────

export async function runCalendarIntelligence(userId: string, emailId: string) {
  const email = await db.email.findUnique({
    where: { id: emailId },
    select: {
      id: true,
      subject: true,
      fromAddress: true,
      fromName: true,
      snippet: true,
      bodyText: true,
      receivedAt: true,
      importanceScore: true,
    },
  });

  if (!email || (email.importanceScore ?? 0) < 40) return; // skip low-signal emails

  const detection = await detectSpecialEvents({ ...email, snippet: email.snippet ?? "" });
  if (!detection) return;

  const alerts: Promise<any>[] = [];

  // ── Absence conflict detection ──────────────────────────────────────────────
  if (detection.absence_detected && detection.person_email && detection.start_date) {
    const conflicts = await findCalendarConflicts(
      userId,
      detection.person_email,
      detection.start_date,
      detection.end_date ?? detection.start_date
    );

    for (const conflict of conflicts) {
      const alertBody = buildAbsenceAlertBody({
        personName: detection.person_name ?? detection.person_email,
        startDate: detection.start_date,
        endDate: detection.end_date,
        reason: detection.reason,
        eventTitle: conflict.title,
        eventTime: format(conflict.startTime, "EEE MMM d 'at' h:mm a"),
      });

      alerts.push(
        db.smartAlert.create({
          data: {
            userId,
            type: "ABSENCE_CONFLICT",
            urgency: "HIGH",
            title: `${detection.person_name ?? "Team member"} absence conflicts with meeting`,
            body: alertBody,
            sourceEmailId: email.id,
            sourceEventId: conflict.id,
            subjectPerson: detection.person_email,
            subjectDate: detection.start_date,
          },
        })
      );
    }
  }

  // ── Deadline detection ─────────────────────────────────────────────────────
  if (detection.deadline_detected && detection.deadline_description && detection.deadline_date) {
    const deadlineParsed = safeParseDate(detection.deadline_date);
    if (deadlineParsed) {
      alerts.push(
        db.smartAlert.create({
          data: {
            userId,
            type: "DEADLINE_RISK",
            urgency: isWithin48Hours(deadlineParsed) ? "CRITICAL" : "HIGH",
            title: `Deadline: ${detection.deadline_description}`,
            body: `Deadline detected from email: "${email.subject}". Due ${format(deadlineParsed, "EEEE, MMM d")}.`,
            sourceEmailId: email.id,
            subjectDate: detection.deadline_date,
          },
        })
      );
    }
  }

  // ── Meeting reschedule ─────────────────────────────────────────────────────
  if (detection.meeting_reschedule_detected) {
    alerts.push(
      db.smartAlert.create({
        data: {
          userId,
          type: "MEETING_CHANGE",
          urgency: "MEDIUM",
          title: `Meeting reschedule mentioned: ${email.subject}`,
          body: `${email.fromName ?? email.fromAddress} may be requesting or confirming a meeting change. Review: "${email.snippet}"`,
          sourceEmailId: email.id,
        },
      })
    );
  }

  if (alerts.length > 0) {
    await Promise.all(alerts);
    await db.auditLog.create({
      data: {
        userId,
        action: "CALENDAR_INTELLIGENCE",
        detail: `Generated ${alerts.length} smart alerts from email "${email.subject}"`,
        meta: { emailId, alertCount: alerts.length },
      },
    });
  }
}

// ─── AI DETECTION ────────────────────────────────────────────────────────────

async function detectSpecialEvents(email: {
  subject: string;
  fromName: string | null;
  fromAddress: string;
  snippet: string;
  bodyText: string | null;
}) {
  // Fast keyword pre-filter to avoid unnecessary AI calls
  const fullText = `${email.subject} ${email.snippet} ${email.bodyText ?? ""}`.toLowerCase();
  const hasSignal =
    /leave|vacation|sick|away|unavailable|out of office|wfh|rescheduled?|deadline|due by|by friday|by monday/.test(
      fullText
    );

  if (!hasSignal) return null;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Extract structured information from this email. Today is ${format(new Date(), "yyyy-MM-dd")}.
Be precise. For dates, use YYYY-MM-DD format. If a date is relative ("tomorrow", "next Monday"), resolve it.`,
        },
        {
          role: "user",
          content: `FROM: ${email.fromName ?? email.fromAddress} <${email.fromAddress}>
SUBJECT: ${email.subject}
BODY: ${(email.bodyText ?? email.snippet).slice(0, 600)}`,
        },
      ],
      response_format: zodResponseFormat(AbsenceDetectionSchema, "absence_detection"),
    });

    return AbsenceDetectionSchema.parse(JSON.parse(response.choices[0].message.content!));
  } catch {
    return null;
  }
}

// ─── CALENDAR LOOKUP ─────────────────────────────────────────────────────────

async function findCalendarConflicts(
  userId: string,
  personEmail: string,
  startDateStr: string,
  endDateStr: string
) {
  const start = safeParseDate(startDateStr);
  const end = safeParseDate(endDateStr);
  if (!start) return [];

  const windowStart = startOfDay(start);
  const windowEnd = endOfDay(end ?? start);

  const events = await db.calendarEvent.findMany({
    where: {
      userId,
      startTime: { gte: windowStart, lte: windowEnd },
      isDeleted: false,
    },
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true,
      attendees: true,
    },
  });

  return events.filter((event) => {
    const attendees = event.attendees as Array<{ email: string; name?: string }>;
    return attendees.some(
      (a) => a.email.toLowerCase() === personEmail.toLowerCase()
    );
  });
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function buildAbsenceAlertBody(params: {
  personName: string;
  startDate: string;
  endDate: string | null;
  reason: string | null;
  eventTitle: string;
  eventTime: string;
}): string {
  const dateRange =
    params.endDate && params.endDate !== params.startDate
      ? `${format(parseISO(params.startDate), "MMM d")}–${format(parseISO(params.endDate), "MMM d")}`
      : format(parseISO(params.startDate), "EEEE, MMM d");

  const reasonPart = params.reason ? ` (${params.reason})` : "";

  return `${params.personName} will be away on ${dateRange}${reasonPart}. They are listed as an attendee for **${params.eventTitle}** scheduled ${params.eventTime}.`;
}

function safeParseDate(dateStr: string): Date | null {
  try {
    const d = parseISO(dateStr);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

function isWithin48Hours(date: Date): boolean {
  return date.getTime() - Date.now() < 48 * 3600_000;
}

// ─── BATCH PROCESSOR ─────────────────────────────────────────────────────────
// Called after each Gmail sync to check new important emails

export async function processNewEmailsForIntelligence(userId: string) {
  const unprocessedEmails = await db.email.findMany({
    where: {
      userId,
      importanceScore: { gte: 50 },
      category: { notIn: ["NEWSLETTER", "PROMO", "IGNORE"] },
      isDeleted: false,
      receivedAt: { gte: new Date(Date.now() - 24 * 3600_000) },
    },
    select: { id: true },
    take: 20,
  });

  await Promise.allSettled(
    unprocessedEmails.map((e) => runCalendarIntelligence(userId, e.id))
  );
}
