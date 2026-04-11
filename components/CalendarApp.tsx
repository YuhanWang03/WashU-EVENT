"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import type { CalendarEvent } from "@/lib/types";
import {
  addWeeksSafe,
  formatMonthYear,
  getWeekDays,
  getWeekRange,
} from "@/lib/dates";
import {
  addLocalEvent,
  deleteEvent as deleteInStore,
  emptyStore,
  loadStore,
  mergeEvents,
  patchEvent,
  saveStore,
  type LocalOverride,
  type LocalStore,
} from "@/lib/localStore";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import WeekView from "@/components/WeekView";
import ChatPanel from "@/components/ChatPanel";
import EventModal from "@/components/EventModal";
import { buildScheduleText } from "@/lib/schedule";

function truncate(text: string, max: number) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

type EditingState =
  | { mode: "edit"; event: CalendarEvent }
  | { mode: "create"; event: CalendarEvent }
  | null;

export default function CalendarApp() {
  const { data: session } = useSession();
  const userKey = session?.user?.email ?? "anonymous";

  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [store, setStore] = useState<LocalStore>(() => emptyStore());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [editing, setEditing] = useState<EditingState>(null);

  // Load per-user store from localStorage on mount / user change.
  useEffect(() => {
    setStore(loadStore(userKey));
  }, [userKey]);

  // Persist store to localStorage on change.
  useEffect(() => {
    saveStore(userKey, store);
  }, [userKey, store]);

  const weekDays = useMemo(() => getWeekDays(anchorDate), [anchorDate]);
  const weekRange = useMemo(() => getWeekRange(anchorDate), [anchorDate]);
  const viewLabel = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    return `Week of ${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
  }, [weekDays]);

  const events = useMemo(
    () => mergeEvents(googleEvents, store),
    [googleEvents, store],
  );

  const scheduleText = useMemo(
    () => buildScheduleText(weekDays, events),
    [weekDays, events],
  );

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
      setGoogleEvents(data.events ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load events");
      setGoogleEvents([]);
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

  // Mutations — all go through the local store, never hit Google.
  const handlePatchEvent = useCallback(
    (id: string, patch: LocalOverride) => {
      setStore((s) => patchEvent(s, id, patch));
    },
    [],
  );

  const handleCreateAt = useCallback((start: Date, end: Date) => {
    const draft: CalendarEvent = {
      id: "__draft__",
      summary: "",
      description: "",
      location: "",
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: false,
      htmlLink: null,
      colorId: null,
    };
    setEditing({ mode: "create", event: draft });
  }, []);

  const handleOpenEdit = useCallback((event: CalendarEvent) => {
    setEditing({ mode: "edit", event });
  }, []);

  const handleModalSave = (patch: {
    summary: string;
    start: string;
    end: string;
    description?: string;
    location?: string;
  }) => {
    if (!editing) return;
    if (editing.mode === "create") {
      setStore((s) => addLocalEvent(s, patch).store);
    } else {
      setStore((s) => patchEvent(s, editing.event.id, patch));
    }
    setEditing(null);
  };

  const handleModalDelete = () => {
    if (!editing || editing.mode !== "edit") return;
    setStore((s) => deleteInStore(s, editing.event.id));
    setEditing(null);
  };

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
          <WeekView
            days={weekDays}
            events={events}
            loading={loading}
            store={store}
            onPatchEvent={handlePatchEvent}
            onOpenEvent={handleOpenEdit}
            onCreateAt={handleCreateAt}
          />
        </main>

        {chatOpen && (
          <aside className="w-[360px] min-w-[320px] border-l border-gcal-border bg-white">
            <ChatPanel
              events={events}
              viewLabel={viewLabel}
              scheduleText={scheduleText}
              onClose={() => setChatOpen(false)}
            />
          </aside>
        )}
      </div>

      <EventModal
        open={editing !== null}
        event={editing?.event ?? null}
        isNew={editing?.mode === "create"}
        onClose={() => setEditing(null)}
        onSave={handleModalSave}
        onDelete={handleModalDelete}
      />
    </div>
  );
}
