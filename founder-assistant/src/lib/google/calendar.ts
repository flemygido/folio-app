import { google } from "googleapis";
import { getGmailClient } from "./gmail"; // reuse same OAuth2 client
import { db } from "@/lib/db";
import type { CalendarEventRaw } from "@/types";

export async function syncCalendarIncremental(userId: string, syncToken?: string) {
  const auth = await getGmailClient(userId); // same Google account tokens
  const calendar = google.calendar({ version: "v3", auth });

  const now = new Date();
  const twoWeeksFromNow = new Date(now.getTime() + 14 * 86400_000);

  let events: CalendarEventRaw[] = [];
  let newSyncToken = syncToken;

  try {
    const res = await calendar.events.list({
      calendarId: "primary",
      syncToken: syncToken ?? undefined,
      timeMin: syncToken ? undefined : now.toISOString(),
      timeMax: syncToken ? undefined : twoWeeksFromNow.toISOString(),
      singleEvents: true,
      maxResults: 100,
    });

    newSyncToken = res.data.nextSyncToken ?? syncToken;
    events = (res.data.items ?? []).map(parseCalendarEvent).filter(Boolean) as CalendarEventRaw[];
  } catch (err: any) {
    if (err?.code === 410) {
      // syncToken expired, do full sync
      const res = await calendar.events.list({
        calendarId: "primary",
        timeMin: now.toISOString(),
        timeMax: twoWeeksFromNow.toISOString(),
        singleEvents: true,
        maxResults: 200,
      });
      newSyncToken = res.data.nextSyncToken ?? undefined;
      events = (res.data.items ?? []).map(parseCalendarEvent).filter(Boolean) as CalendarEventRaw[];
    } else {
      throw err;
    }
  }

  return { events, newSyncToken };
}

function parseCalendarEvent(raw: any): CalendarEventRaw | null {
  if (!raw.id || raw.status === "cancelled") return null;
  try {
    const isAllDay = Boolean(raw.start?.date && !raw.start?.dateTime);
    const startTime = raw.start?.dateTime
      ? new Date(raw.start.dateTime)
      : new Date(raw.start?.date ?? Date.now());
    const endTime = raw.end?.dateTime
      ? new Date(raw.end.dateTime)
      : new Date(raw.end?.date ?? Date.now());

    const meetLink =
      raw.hangoutLink ??
      raw.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === "video")?.uri ??
      null;

    return {
      googleEventId: raw.id,
      calendarId: "primary",
      title: raw.summary ?? "(No title)",
      description: raw.description ?? null,
      startTime,
      endTime,
      isAllDay,
      attendees: (raw.attendees ?? []).map((a: any) => ({
        email: a.email,
        name: a.displayName ?? null,
        responseStatus: a.responseStatus ?? "needsAction",
      })),
      organizer: raw.organizer
        ? { email: raw.organizer.email, name: raw.organizer.displayName ?? null }
        : null,
      location: raw.location ?? null,
      meetLink,
    };
  } catch {
    return null;
  }
}

export async function upsertCalendarEvents(userId: string, events: CalendarEventRaw[]) {
  await Promise.allSettled(
    events.map((evt) =>
      db.calendarEvent.upsert({
        where: { googleEventId: evt.googleEventId },
        update: {
          title: evt.title,
          description: evt.description,
          startTime: evt.startTime,
          endTime: evt.endTime,
          attendees: evt.attendees,
          organizer: evt.organizer ?? undefined,
          location: evt.location,
          meetLink: evt.meetLink,
        },
        create: {
          userId,
          ...evt,
          attendees: evt.attendees,
          organizer: evt.organizer ?? undefined,
        },
      })
    )
  );
}
