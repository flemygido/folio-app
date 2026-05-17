import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { format, isToday, isTomorrow, isThisWeek } from "date-fns";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const events = await db.calendarEvent.findMany({
    where: {
      userId,
      startTime: { gte: new Date() },
      isDeleted: false,
    },
    orderBy: { startTime: "asc" },
    take: 30,
  });

  const grouped: Record<string, typeof events> = {};
  for (const evt of events) {
    const key = format(evt.startTime, "yyyy-MM-dd");
    grouped[key] = grouped[key] ?? [];
    grouped[key].push(evt);
  }

  function dayLabel(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    if (isToday(d)) return "Today";
    if (isTomorrow(d)) return "Tomorrow";
    if (isThisWeek(d)) return format(d, "EEEE");
    return format(d, "EEE, MMM d");
  }

  return (
    <div>
      <div className="mb-5">
        <div className="text-[11px] text-blue-400 font-bold uppercase tracking-widest mb-1.5">
          Calendar · Upcoming
        </div>
        <h2 className="text-2xl font-bold text-slate-100" style={{ fontFamily: "var(--font-dm-serif)" }}>
          Your schedule
        </h2>
        <p className="text-[13px] text-slate-500 mt-1.5">
          {events.length} upcoming events
        </p>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 text-slate-600">
          <div className="text-3xl mb-3">📅</div>
          <div className="text-sm">No upcoming events.</div>
          <div className="text-xs text-slate-700 mt-2">Sync your Google Calendar to see events here.</div>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([dateStr, dayEvents]) => (
            <div key={dateStr}>
              <div className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-2">
                {dayLabel(dateStr)} · {format(new Date(dateStr + "T00:00:00"), "MMMM d")}
              </div>
              <div className="space-y-2">
                {dayEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 flex gap-3 items-start"
                    style={{ borderColor: evt.importance === "high" ? "#1d4ed8" : "#1e293b" }}
                  >
                    <div className="text-xl flex-shrink-0">📅</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-200" style={{ fontFamily: "var(--font-dm-serif)" }}>
                          {evt.title}
                        </span>
                        {evt.importance === "high" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded border border-blue-800 bg-blue-900/30 text-blue-300 font-bold uppercase tracking-wide">
                            Important
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {format(evt.startTime, "h:mm a")}
                        {evt.endTime && ` – ${format(evt.endTime, "h:mm a")}`}
                        {Array.isArray(evt.attendees) && (evt.attendees as any[]).length > 0 && (
                          <span className="ml-2">
                            · {(evt.attendees as any[]).slice(0, 3).map((a: any) => a.name ?? a.email).join(", ")}
                            {(evt.attendees as any[]).length > 3 && ` +${(evt.attendees as any[]).length - 3}`}
                          </span>
                        )}
                      </div>
                      {evt.location && (
                        <div className="text-xs text-slate-600 mt-1">📍 {evt.location}</div>
                      )}
                      {evt.prepNote && (
                        <div className="mt-2 text-xs text-blue-300 bg-[#0a1628] border border-[#1e3a5f] rounded-md px-3 py-1.5">
                          💡 {evt.prepNote}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
