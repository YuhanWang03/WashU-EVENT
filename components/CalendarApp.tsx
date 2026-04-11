"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import type { CalendarEvent } from "@/lib/types";
import {
  addWeeksSafe,
  formatMonthYear,
  getWeekDays,
  getWeekRange,
} from "@/lib/dates";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import WeekView from "@/components/WeekView";
import ChatPanel from "@/components/ChatPanel";

function truncate(text: string, max: number) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export default function CalendarApp() {
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);

  const weekDays = useMemo(() => getWeekDays(anchorDate), [anchorDate]);
  const weekRange = useMemo(() => getWeekRange(anchorDate), [anchorDate]);
  const viewLabel = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    return `Week of ${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
  }, [weekDays]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        timeMin: weekRange.start.toISOString(),
        timeMax: weekRange.end.toISOString(),
      });
      const res = await fetch(`/api/calendar/events?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const code = body?.error ?? `status ${res.status}`;
        const detail = body?.detail ? ` — ${truncate(body.detail, 220)}` : "";
        throw new Error(`${code}${detail}`);
      }
      const data = await res.json();
      setEvents(data.events ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load events");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [weekRange.start, weekRange.end]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const goToday = () => setAnchorDate(new Date());
  const goPrev = () => setAnchorDate((d) => addWeeksSafe(d, -1));
  const goNext = () => setAnchorDate((d) => addWeeksSafe(d, 1));

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white">
      <TopBar
        monthLabel={formatMonthYear(anchorDate)}
        onToday={goToday}
        onPrev={goPrev}
        onNext={goNext}
        onToggleChat={() => setChatOpen((v) => !v)}
        chatOpen={chatOpen}
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar anchorDate={anchorDate} setAnchorDate={setAnchorDate} />

        <main className="relative flex min-w-0 flex-1 border-l border-gcal-border">
          {error && (
            <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-700 shadow">
              {error}
            </div>
          )}
          <WeekView days={weekDays} events={events} loading={loading} />
        </main>

        {chatOpen && (
          <aside className="w-[360px] min-w-[320px] border-l border-gcal-border bg-white">
            <ChatPanel
              events={events}
              viewLabel={viewLabel}
              onClose={() => setChatOpen(false)}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
