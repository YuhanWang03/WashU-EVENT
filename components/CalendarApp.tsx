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
  isLocalId,
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
import { composeLocalDate, type CalendarAction } from "@/lib/actions";
import {
  buildHealthText,
  computeStateLevel,
  type DetailedHealth,
  type HealthSummary,
} from "@/lib/health";
import type { StateLevel } from "@/lib/types";
import {
  addBlueTask,
  loadBlueTasks,
  pendingTasks as getPendingTasks,
  saveBlueTasks,
} from "@/lib/blueTaskStore";
import { scheduleTwoDays, type BlueTask } from "@/lib/scheduler";
import { getTaskCategory } from "@/lib/taskCategory";
import BlueTaskPanel from "@/components/BlueTaskPanel";
import DailyBriefing from "@/components/DailyBriefing";

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
  const [health, setHealth] = useState<HealthSummary | null>(null);
  const [detailedHealth, setDetailedHealth] = useState<DetailedHealth | null>(null);
  const [stateLevel, setStateLevel] = useState<StateLevel | null>(null);
  const [blueTasks, setBlueTasks] = useState<BlueTask[]>([]);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [schedulerNotes, setSchedulerNotes] = useState<string[]>([]);
  const [deferredPurpleNames, setDeferredPurpleNames] = useState<string[]>([]);

  // Load per-user store from localStorage on mount / user change.
  useEffect(() => {
    setStore(loadStore(userKey));
    setBlueTasks(loadBlueTasks(userKey));
  }, [userKey]);

  // Persist store to localStorage on change.
  useEffect(() => {
    saveStore(userKey, store);
  }, [userKey, store]);

  // Persist blue tasks on change.
  useEffect(() => {
    saveBlueTasks(userKey, blueTasks);
  }, [userKey, blueTasks]);

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

  const healthText = useMemo(
    () => buildHealthText(health, detailedHealth, stateLevel),
    [health, detailedHealth, stateLevel],
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

  // Fetch Google Fit data once per session.  We fire both requests in
  // parallel; failures null out the relevant state so the app degrades
  // gracefully — Gemini still works, just without health context.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [summaryRes, detailRes] = await Promise.all([
          fetch("/api/fit/summary"),
          fetch("/api/fit/detail"),
        ]);

        const summaryData: HealthSummary = summaryRes.ok
          ? await summaryRes.json()
          : { available: false };

        const detailData: DetailedHealth | null = detailRes.ok
          ? await detailRes.json()
          : null;

        if (!cancelled) {
          setHealth(summaryData);
          setDetailedHealth(detailData);
          const level = computeStateLevel(summaryData, detailData);
          setStateLevel(level);
          // Trigger initial scheduling after health data is available.
          setTimeout(() => {
            triggerReschedule();
            // Show daily briefing once per day.
            const todayKey = new Date().toISOString().slice(0, 10);
            const briefingKey = `washu-event-briefing::${userKey}::${todayKey}`;
            if (!localStorage.getItem(briefingKey)) {
              setBriefingOpen(true);
              localStorage.setItem(briefingKey, "1");
            }
          }, 100);
        }
      } catch {
        if (!cancelled) setHealth({ available: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userKey]);

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

  // Apply a batch of structured actions coming from Gemini. Each action is
  // dispatched through the local store, exactly like a manual drag/edit.
  const handleApplyActions = useCallback(
    (actions: CalendarAction[]): number => {
      if (!actions.length) return 0;
      let applied = 0;
      setStore((s) => {
        let next = s;
        for (const a of actions) {
          try {
            if (a.type === "move") {
              const start = composeLocalDate(a.day, a.start).toISOString();
              const end = composeLocalDate(a.day, a.end).toISOString();
              next = patchEvent(next, a.id, { start, end });
              applied++;
            } else if (a.type === "rename") {
              next = patchEvent(next, a.id, { summary: a.summary });
              applied++;
            } else if (a.type === "delete") {
              next = deleteInStore(next, a.id);
              applied++;
            } else if (a.type === "create") {
              const start = composeLocalDate(a.day, a.start).toISOString();
              const end = composeLocalDate(a.day, a.end).toISOString();
              next = addLocalEvent(next, {
                summary: a.summary,
                start,
                end,
              }).store;
              applied++;
            }
          } catch {
            // Skip malformed actions rather than aborting the whole batch.
          }
        }
        return next;
      });
      return applied;
    },
    [],
  );

  // Run the scheduling engine for today + tomorrow.
  // Called after health data loads, after tasks are added, or on reschedule signal.
  const triggerReschedule = useCallback(
    (elapsedMinutes?: number) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Summaries of blue events already placed in the calendar (to avoid duplication).
      const placedSummaries = new Set(
        events
          .filter((ev) => {
            const cat = getTaskCategory(ev.colorId);
            return cat === "blue" || isLocalId(ev.id);
          })
          .map((ev) => ev.summary),
      );

      const pending = getPendingTasks(blueTasks, today).filter(
        (t) => !placedSummaries.has(t.summary),
      );

      const currentTime = elapsedMinutes
        ? new Date(Date.now() + elapsedMinutes * 60000)
        : new Date();

      const result = scheduleTwoDays(
        today,
        events,
        pending,
        stateLevel ?? "normal",
        currentTime,
      );

      if (result.actions.length > 0) {
        handleApplyActions(result.actions);
      }

      // Store output for the daily briefing.
      setSchedulerNotes(result.notes);
      setDeferredPurpleNames(result.deferredPurple.map((e) => e.summary));
      return result;
    },
    [events, blueTasks, stateLevel, handleApplyActions],
  );

  // Add a blue task and immediately trigger scheduling.
  const handleAddBlueTask = useCallback(
    (task: Omit<BlueTask, "id">) => {
      setBlueTasks((prev) => {
        const updated = addBlueTask(prev, task);
        saveBlueTasks(userKey, updated);
        return updated;
      });
      // Small delay so the state update settles before scheduling.
      setTimeout(() => triggerReschedule(), 50);
    },
    [userKey, triggerReschedule],
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gcal-bg">
      <TopBar
        monthLabel={formatMonthYear(anchorDate)}
        onToday={goToday}
        onPrev={goPrev}
        onNext={goNext}
        onToggleChat={() => setChatOpen((v) => !v)}
        chatOpen={chatOpen}
        onAddTask={() => setTaskPanelOpen(true)}
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
              healthText={healthText}
              health={health}
              stateLevel={stateLevel}
              onClose={() => setChatOpen(false)}
              onApplyActions={handleApplyActions}
              onReschedule={triggerReschedule}
            />
          </aside>
        )}
      </div>

      <DailyBriefing
        open={briefingOpen}
        onClose={() => setBriefingOpen(false)}
        stateLevel={stateLevel}
        health={health}
        detailedHealth={detailedHealth}
        events={events}
        schedulerNotes={schedulerNotes}
        deferredPurpleNames={deferredPurpleNames}
        onAddNap={(start, end) => {
          setStore((s) =>
            addLocalEvent(s, {
              summary: "Nap",
              start: start.toISOString(),
              end: end.toISOString(),
            }).store,
          );
          setBriefingOpen(false);
        }}
      />

      <BlueTaskPanel
        open={taskPanelOpen}
        onClose={() => setTaskPanelOpen(false)}
        onAdd={handleAddBlueTask}
      />

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
