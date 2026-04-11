"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, isSameDay } from "date-fns";
import type { CalendarEvent } from "@/lib/types";
import { formatDayNumber, formatDayShort, formatHourLabel } from "@/lib/dates";

type Props = {
  days: Date[];
  events: CalendarEvent[];
  loading: boolean;
};

const HOUR_HEIGHT = 48; // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function WeekView({ days, events, loading }: Props) {
  const [now, setNow] = useState<Date>(() => new Date());
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Scroll to ~7 AM on first render
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
    }
  }, []);

  const timedEventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const day of days) {
      map[day.toDateString()] = [];
    }
    for (const ev of events) {
      if (!ev.start || !ev.end || ev.allDay) continue;
      const s = new Date(ev.start);
      const dayKey = days.find((d) => isSameDay(d, s))?.toDateString();
      if (dayKey) map[dayKey]?.push(ev);
    }
    return map;
  }, [events, days]);

  const allDayByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const day of days) map[day.toDateString()] = [];
    for (const ev of events) {
      if (!ev.allDay || !ev.start) continue;
      const s = new Date(ev.start);
      const key = days.find((d) => isSameDay(d, s))?.toDateString();
      if (key) map[key]?.push(ev);
    }
    return map;
  }, [events, days]);

  const today = new Date();

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* Day header row */}
      <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-gcal-border">
        <div className="border-r border-gcal-border" />
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className="flex flex-col items-center justify-center gap-1 border-r border-gcal-border py-2"
            >
              <div
                className={`text-[11px] font-medium ${
                  isToday ? "text-gcal-blue" : "text-gcal-subtext"
                }`}
              >
                {formatDayShort(d)}
              </div>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xl ${
                  isToday
                    ? "bg-gcal-blue text-white"
                    : "text-gcal-text hover:bg-gray-100"
                }`}
              >
                {formatDayNumber(d)}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day row */}
      <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-gcal-border">
        <div className="flex items-start justify-end border-r border-gcal-border pr-2 pt-1 text-[10px] text-gcal-subtext">
          GMT{getLocalOffset()}
        </div>
        {days.map((d) => {
          const key = d.toDateString();
          const items = allDayByDay[key] ?? [];
          return (
            <div
              key={key}
              className="min-h-[24px] border-r border-gcal-border px-1 py-0.5"
            >
              {items.slice(0, 3).map((ev) => (
                <div
                  key={ev.id}
                  title={ev.summary}
                  className="mb-0.5 truncate rounded bg-blue-100 px-1 text-[11px] text-blue-800"
                >
                  {ev.summary}
                </div>
              ))}
              {items.length > 3 && (
                <div className="text-[10px] text-gcal-subtext">
                  +{items.length - 3} more
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div
        ref={scrollRef}
        className="scroll-thin relative flex-1 overflow-y-auto"
      >
        <div
          className="grid grid-cols-[64px_repeat(7,1fr)]"
          style={{ height: `${HOUR_HEIGHT * 24}px` }}
        >
          {/* Hour labels column */}
          <div className="relative border-r border-gcal-border">
            {HOURS.map((h) => (
              <div
                key={h}
                className="relative"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                <span className="absolute right-2 top-[-7px] bg-white px-1 text-[10px] text-gcal-subtext">
                  {formatHourLabel(h)}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const key = day.toDateString();
            const dayEvents = timedEventsByDay[key] ?? [];
            const isToday = isSameDay(day, today);
            return (
              <div
                key={key}
                className="relative border-r border-gcal-border"
                style={{ height: `${HOUR_HEIGHT * 24}px` }}
              >
                {/* Hour grid lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="border-b border-gcal-border/60"
                    style={{ height: `${HOUR_HEIGHT}px` }}
                  />
                ))}

                {/* Current time indicator (only on today's column) */}
                {isToday && <NowLine now={now} />}

                {/* Events */}
                {layoutEvents(dayEvents).map(({ ev, topPct, heightPct, col, colCount }) => (
                  <EventBlock
                    key={ev.id}
                    ev={ev}
                    topPct={topPct}
                    heightPct={heightPct}
                    col={col}
                    colCount={colCount}
                  />
                ))}
              </div>
            );
          })}
        </div>

        {loading && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center py-2">
            <span className="rounded-full bg-white px-3 py-1 text-[11px] text-gcal-subtext shadow">
              Loading events…
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function NowLine({ now }: { now: Date }) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const top = (minutes / (24 * 60)) * 100;
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-10"
      style={{ top: `${top}%` }}
    >
      <div className="relative">
        <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
        <div className="h-px w-full bg-red-500" />
      </div>
    </div>
  );
}

type Laid = {
  ev: CalendarEvent;
  topPct: number;
  heightPct: number;
  col: number;
  colCount: number;
};

// Simple column layout for overlapping events.
function layoutEvents(evs: CalendarEvent[]): Laid[] {
  const sorted = [...evs].sort((a, b) => {
    const as = a.start ? new Date(a.start).getTime() : 0;
    const bs = b.start ? new Date(b.start).getTime() : 0;
    return as - bs;
  });

  const columns: CalendarEvent[][] = [];
  const colOfId: Record<string, number> = {};

  for (const ev of sorted) {
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      const last = columns[c][columns[c].length - 1];
      if (!overlaps(last, ev)) {
        columns[c].push(ev);
        colOfId[ev.id] = c;
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([ev]);
      colOfId[ev.id] = columns.length - 1;
    }
  }
  const colCount = Math.max(1, columns.length);

  return sorted.map((ev) => {
    const start = new Date(ev.start!);
    const end = new Date(ev.end!);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    const duration = Math.max(15, endMin - startMin);
    const topPct = (startMin / (24 * 60)) * 100;
    const heightPct = (duration / (24 * 60)) * 100;
    return {
      ev,
      topPct,
      heightPct,
      col: colOfId[ev.id] ?? 0,
      colCount,
    };
  });
}

function overlaps(a: CalendarEvent, b: CalendarEvent) {
  if (!a.start || !a.end || !b.start || !b.end) return false;
  const as = new Date(a.start).getTime();
  const ae = new Date(a.end).getTime();
  const bs = new Date(b.start).getTime();
  const be = new Date(b.end).getTime();
  return as < be && bs < ae;
}

function EventBlock({
  ev,
  topPct,
  heightPct,
  col,
  colCount,
}: Laid) {
  const widthPct = 100 / colCount;
  const leftPct = col * widthPct;

  return (
    <div
      className="absolute overflow-hidden rounded-md bg-gcal-blue px-1.5 py-1 text-[11px] text-white shadow-sm hover:opacity-95"
      style={{
        top: `${topPct}%`,
        height: `${heightPct}%`,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
      }}
      title={`${ev.summary}\n${ev.start ? format(new Date(ev.start), "p") : ""} – ${ev.end ? format(new Date(ev.end), "p") : ""}`}
    >
      <div className="truncate font-medium">{ev.summary}</div>
      {ev.start && ev.end && (
        <div className="truncate opacity-90">
          {format(new Date(ev.start), "p")} – {format(new Date(ev.end), "p")}
        </div>
      )}
    </div>
  );
}

function getLocalOffset(): string {
  const offset = -new Date().getTimezoneOffset() / 60;
  const sign = offset >= 0 ? "+" : "-";
  return `${sign}${Math.abs(offset).toString().padStart(2, "0")}`;
}
