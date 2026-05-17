import { graphFetch } from "./graph";

export interface MicrosoftCalendarEvent {
  id: string;
  subject: string;
  bodyPreview: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  location: string | null;
  onlineMeetingUrl: string | null;
  organizer: { email: string; name: string | null } | null;
  attendees: { email: string; name: string | null; status: string }[];
  isCancelled: boolean;
}

const EVENT_SELECT = [
  "id",
  "subject",
  "bodyPreview",
  "start",
  "end",
  "isAllDay",
  "isCancelled",
  "location",
  "onlineMeeting",
  "organizer",
  "attendees",
].join(",");

export interface MicrosoftCalendarSyncResult {
  events: MicrosoftCalendarEvent[];
  deltaLink: string;
}

export async function syncMicrosoftCalendarIncremental(
  userId: string,
  deltaLink?: string
): Promise<MicrosoftCalendarSyncResult> {
  const path = deltaLink ?? buildInitialDeltaUrl();

  const items: any[] = [];
  let nextUrl: string | null = path;
  let finalDeltaLink = deltaLink ?? "";

  while (nextUrl) {
    const data = await graphFetch(userId, "MICROSOFT_CALENDAR", nextUrl);
    items.push(...(data.value ?? []));
    nextUrl = data["@odata.nextLink"] ?? null;
    if (data["@odata.deltaLink"]) finalDeltaLink = data["@odata.deltaLink"];
    if (items.length >= 200) break;
  }

  const events = items
    .filter((e) => !e["@removed"])
    .map(parseMicrosoftEvent)
    .filter(Boolean) as MicrosoftCalendarEvent[];

  return { events, deltaLink: finalDeltaLink };
}

function buildInitialDeltaUrl(): string {
  const now = new Date();
  const start = new Date(now.getTime() - 1 * 86400_000).toISOString(); // yesterday
  const end = new Date(now.getTime() + 14 * 86400_000).toISOString();  // 2 weeks ahead
  const select = encodeURIComponent(EVENT_SELECT);
  return `/me/calendarView/delta?startDateTime=${start}&endDateTime=${end}&$select=${select}&$top=50`;
}

function parseMicrosoftEvent(raw: any): MicrosoftCalendarEvent | null {
  try {
    return {
      id: raw.id,
      subject: raw.subject || "(no title)",
      bodyPreview: raw.bodyPreview ?? "",
      start: new Date(raw.start?.dateTime + "Z"),
      end: new Date(raw.end?.dateTime + "Z"),
      isAllDay: raw.isAllDay ?? false,
      isCancelled: raw.isCancelled ?? false,
      location: raw.location?.displayName || null,
      onlineMeetingUrl: raw.onlineMeeting?.joinUrl ?? null,
      organizer: raw.organizer?.emailAddress
        ? { email: raw.organizer.emailAddress.address, name: raw.organizer.emailAddress.name || null }
        : null,
      attendees: (raw.attendees ?? []).map((a: any) => ({
        email: a.emailAddress?.address ?? "",
        name: a.emailAddress?.name || null,
        status: a.status?.response ?? "none",
      })),
    };
  } catch {
    return null;
  }
}

export function microsoftEventToCalendarEvent(
  userId: string,
  event: MicrosoftCalendarEvent
) {
  return {
    userId,
    calendarSource: "MICROSOFT",
    outlookEventId: event.id,
    googleEventId: null,
    calendarId: "primary",
    title: event.subject,
    description: event.bodyPreview || null,
    startTime: event.start,
    endTime: event.end,
    isAllDay: event.isAllDay,
    isDeleted: event.isCancelled,
    location: event.location,
    meetLink: event.onlineMeetingUrl,
    organizer: event.organizer ?? {},
    attendees: event.attendees,
    importance: "medium",
  };
}
