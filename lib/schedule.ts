"use client";

import { format, isSameDay } from "date-fns";
import type { CalendarEvent } from "@/lib/types";

/**
 * Produce a markdown-ish, human-readable per-day schedule for the current
 * week view, including explicit free slots. This is sent to Gemini as
 * context so it doesn't have to reason about absolute ISO timestamps or
 * infer that blank time == free time.
 *
 * Everything is computed in the user's LOCAL time via the browser's
 * `Date` object, which is why this lives on the client: the server is
 * in UTC on Vercel and would otherwise need an IANA timezone round-trip.
 */

const DAY_START_HOUR = 8; // 8 AM — "schedulable window" start
const DAY_END_HOUR = 22; // 10 PM — "schedulable window" end

type Timed = CalendarEvent & { _s: Date; _e: Date };

export function buildScheduleText(
  days: Date[],
  events: CalendarEvent[],
): string {
  const lines: string[] = [];

  for (const day of days) {
    const dayLabel = format(day, "EEEE, MMM d, yyyy");
    const dayStart = new Date(day);
    dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);

    const allDayEvents = events.filter(
      (e) => e.allDay && e.start && isSameDay(new Date(e.start), day),
    );

    const timed: Timed[] = events
      .filter((e) => !e.allDay && e.start && e.end)
      .map((e) => ({ ...e, _s: new Date(e.start!), _e: new Date(e.end!) }))
      .filter((e) => isSameDay(e._s, day))
      .sort((a, b) => a._s.getTime() - b._s.getTime());

    lines.push(`## ${dayLabel}`);

    if (allDayEvents.length > 0) {
      lines.push(
        `  All-day: ${allDayEvents.map((e) => e.summary).join(", ")}`,
      );
    }

    if (timed.length === 0) {
      lines.push("  Events: (none)");
      lines.push(
        `  Free: ${format(dayStart, "h:mm a")} – ${format(dayEnd, "h:mm a")} (entire schedulable window is open)`,
      );
      lines.push("");
      continue;
    }

    lines.push("  Events:");
    for (const ev of timed) {
      const loc = ev.location ? ` @ ${ev.location}` : "";
      lines.push(
        `    - ${format(ev._s, "h:mm a")} – ${format(ev._e, "h:mm a")}: ${ev.summary}${loc}`,
      );
    }

    // Compute free ranges by subtracting events from [dayStart, dayEnd].
    const freeRanges: { start: Date; end: Date }[] = [];
    let cursor = new Date(dayStart);
    for (const ev of timed) {
      const s = ev._s < dayStart ? dayStart : ev._s;
      const e = ev._e > dayEnd ? dayEnd : ev._e;
      if (s > cursor) freeRanges.push({ start: new Date(cursor), end: s });
      if (e > cursor) cursor = e;
    }
    if (cursor < dayEnd) {
      freeRanges.push({ start: new Date(cursor), end: new Date(dayEnd) });
    }

    if (freeRanges.length === 0) {
      lines.push(
        "  Free slots (8 AM – 10 PM window): none — the day is fully booked in the schedulable window",
      );
    } else {
      lines.push("  Free slots (any blank time is available to schedule):");
      for (const r of freeRanges) {
        const mins = Math.round(
          (r.end.getTime() - r.start.getTime()) / 60000,
        );
        lines.push(
          `    - ${format(r.start, "h:mm a")} – ${format(r.end, "h:mm a")} (${mins} min free)`,
        );
      }
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
