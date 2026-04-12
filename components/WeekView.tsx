"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { addMinutes, format, isSameDay } from "date-fns";
import type { CalendarEvent } from "@/lib/types";
import { isLocalId, isModified, type LocalOverride, type LocalStore } from "@/lib/localStore";
import { formatDayNumber, formatDayShort, formatHourLabel } from "@/lib/dates";
import { getTaskCategory, CATEGORY_STYLE } from "@/lib/taskCategory";

type Props = {
  days: Date[];
  events: CalendarEvent[];
  loading: boolean;
  store: LocalStore;
  onPatchEvent: (id: string, patch: LocalOverride) => void;
  onOpenEvent: (event: CalendarEvent) => void;
  onCreateAt: (start: Date, end: Date) => void;
};

const HOUR_HEIGHT = 48; // px per hour
const SNAP_MIN = 15;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DRAG_THRESHOLD_PX = 4;

type DragState =
  | {
      kind: "move";
      id: string;
      origStart: Date;
      origEnd: Date;
      pointerStartY: number;
      pointerStartX: number;
      startDayIndex: number;
      currentStart: Date;
      currentEnd: Date;
      moved: boolean;
    }
  | {
      kind: "resize";
      id: string;
      origStart: Date;
      origEnd: Date;
      pointerStartY: number;
      currentEnd: Date;
      moved: boolean;
    }
  | null;

export default function WeekView({
  days,
  events,
  loading,
  store,
  onPatchEvent,
  onOpenEvent,
  onCreateAt,
}: Props) {
  const [now, setNow] = useState<Date>(() => new Date());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const dragRef = useRef<DragState>(null);
  dragRef.current = drag;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
    }
  }, []);

  /* ------------------------------------------------------------------ */
  /* Event bucketing                                                    */
  /* ------------------------------------------------------------------ */
  const timedByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const day of days) map[day.toDateString()] = [];
    for (const ev of events) {
      if (!ev.start || !ev.end || ev.allDay) continue;
      const s = new Date(ev.start);
      const key = days.find((d) => isSameDay(d, s))?.toDateString();
      if (key) map[key]!.push(ev);
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
      if (key) map[key]!.push(ev);
    }
    return map;
  }, [events, days]);

  /* ------------------------------------------------------------------ */
  /* Drag handling                                                      */
  /* ------------------------------------------------------------------ */
  const snapToGrid = (minutes: number) =>
    Math.round(minutes / SNAP_MIN) * SNAP_MIN;

  // Find which day column (0..6) a clientX falls under. Returns -1 if none.
  const hitTestDayIndex = (clientX: number, clientY: number): number => {
    const el = document.elementFromPoint(clientX, clientY);
    const colEl = el?.closest<HTMLElement>("[data-day-index]");
    if (!colEl) return -1;
    const idx = Number(colEl.dataset.dayIndex);
    return Number.isFinite(idx) ? idx : -1;
  };

  // Given a clientY and the column element, compute minutes-from-midnight
  // snapped to SNAP_MIN.
  const yToMinutes = (clientY: number, colEl: HTMLElement): number => {
    const rect = colEl.getBoundingClientRect();
    const px = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const minutes = (px / HOUR_HEIGHT) * 60;
    return snapToGrid(minutes);
  };

  const startMoveDrag = (ev: CalendarEvent, e: React.PointerEvent) => {
    if (!ev.start || !ev.end) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const origStart = new Date(ev.start);
    const origEnd = new Date(ev.end);
    const startDayIndex = days.findIndex((d) => isSameDay(d, origStart));
    setDrag({
      kind: "move",
      id: ev.id,
      origStart,
      origEnd,
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      startDayIndex,
      currentStart: origStart,
      currentEnd: origEnd,
      moved: false,
    });
  };

  const startResizeDrag = (ev: CalendarEvent, e: React.PointerEvent) => {
    if (!ev.start || !ev.end) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const origStart = new Date(ev.start);
    const origEnd = new Date(ev.end);
    setDrag({
      kind: "resize",
      id: ev.id,
      origStart,
      origEnd,
      pointerStartY: e.clientY,
      currentEnd: origEnd,
      moved: false,
    });
  };

  const onPointerMoveWindow = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;

      if (d.kind === "move") {
        const dx = e.clientX - d.pointerStartX;
        const dy = e.clientY - d.pointerStartY;
        const moved = d.moved || Math.hypot(dx, dy) > DRAG_THRESHOLD_PX;

        // Minutes delta from Y motion.
        const dMin = snapToGrid((dy / HOUR_HEIGHT) * 60);
        // Day delta from which column we're hovering (fallback: no change).
        const hoverIdx = hitTestDayIndex(e.clientX, e.clientY);
        const dayDelta =
          hoverIdx >= 0 && d.startDayIndex >= 0
            ? hoverIdx - d.startDayIndex
            : 0;

        const newStart = addMinutes(d.origStart, dMin + dayDelta * 24 * 60);
        const durationMin =
          (d.origEnd.getTime() - d.origStart.getTime()) / 60000;
        const newEnd = addMinutes(newStart, durationMin);

        setDrag({
          ...d,
          currentStart: newStart,
          currentEnd: newEnd,
          moved,
        });
      } else if (d.kind === "resize") {
        const dy = e.clientY - d.pointerStartY;
        const moved = d.moved || Math.abs(dy) > DRAG_THRESHOLD_PX;
        const dMin = snapToGrid((dy / HOUR_HEIGHT) * 60);
        let newEnd = addMinutes(d.origEnd, dMin);
        // Enforce at least SNAP_MIN length.
        const minEnd = addMinutes(d.origStart, SNAP_MIN);
        if (newEnd < minEnd) newEnd = minEnd;
        setDrag({ ...d, currentEnd: newEnd, moved });
      }
    },
    [],
  );

  const onPointerUpWindow = useCallback(
    (_e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;

      if (d.moved) {
        if (d.kind === "move") {
          onPatchEvent(d.id, {
            start: d.currentStart.toISOString(),
            end: d.currentEnd.toISOString(),
          });
        } else if (d.kind === "resize") {
          onPatchEvent(d.id, { end: d.currentEnd.toISOString() });
        }
      }
      setDrag(null);
    },
    [onPatchEvent],
  );

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMoveWindow);
    window.addEventListener("pointerup", onPointerUpWindow);
    window.addEventListener("pointercancel", onPointerUpWindow);
    return () => {
      window.removeEventListener("pointermove", onPointerMoveWindow);
      window.removeEventListener("pointerup", onPointerUpWindow);
      window.removeEventListener("pointercancel", onPointerUpWindow);
    };
  }, [onPointerMoveWindow, onPointerUpWindow]);

  /* ------------------------------------------------------------------ */
  /* Click-to-create on empty slot                                      */
  /* ------------------------------------------------------------------ */
  const handleColumnPointerDown = (dayIdx: number, e: React.PointerEvent) => {
    // Let event-block pointerdown stop propagation; this only fires for
    // empty grid clicks.
    if ((e.target as HTMLElement).closest("[data-event-block]")) return;
    // Record start so a drag that moves more than threshold is ignored.
    const startX = e.clientX;
    const startY = e.clientY;
    const colEl = e.currentTarget as HTMLElement;
    const onUp = (u: PointerEvent) => {
      window.removeEventListener("pointerup", onUp);
      const moved =
        Math.hypot(u.clientX - startX, u.clientY - startY) > DRAG_THRESHOLD_PX;
      if (moved) return;
      const minutes = yToMinutes(u.clientY, colEl);
      const day = days[dayIdx];
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      start.setMinutes(minutes);
      const end = addMinutes(start, 60);
      onCreateAt(start, end);
    };
    window.addEventListener("pointerup", onUp);
  };

  /* ------------------------------------------------------------------ */
  /* Render helpers                                                     */
  /* ------------------------------------------------------------------ */
  const today = new Date();

  // While dragging, override the event's displayed time so it moves
  // smoothly before the store commit happens on pointer up.
  const displayEvents = useMemo(() => {
    if (!drag) return events;
    return events.map((e) => {
      if (e.id !== drag.id) return e;
      if (drag.kind === "move") {
        return {
          ...e,
          start: drag.currentStart.toISOString(),
          end: drag.currentEnd.toISOString(),
        };
      }
      return { ...e, end: drag.currentEnd.toISOString() };
    });
  }, [events, drag]);

  // Rebucket after drag-display override so moves across days are visible.
  const dragDisplayByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const day of days) map[day.toDateString()] = [];
    for (const ev of displayEvents) {
      if (!ev.start || !ev.end || ev.allDay) continue;
      const s = new Date(ev.start);
      const key = days.find((d) => isSameDay(d, s))?.toDateString();
      if (key) map[key]!.push(ev);
    }
    return map;
  }, [displayEvents, days]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col select-none">
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
              {items.slice(0, 3).map((ev) => {
                const style = CATEGORY_STYLE[getTaskCategory(ev.colorId)];
                return (
                  <div
                    key={ev.id}
                    title={ev.summary}
                    onClick={() => onOpenEvent(ev)}
                    className={`mb-0.5 cursor-pointer truncate rounded px-1 text-[11px] hover:opacity-80 ${style.chipBg} ${style.chipText}`}
                  >
                    {ev.summary}
                  </div>
                );
              })}
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
          ref={gridRef}
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
          {days.map((day, dayIdx) => {
            const key = day.toDateString();
            const dayEvents = (drag ? dragDisplayByDay : timedByDay)[key] ?? [];
            const isToday = isSameDay(day, today);
            return (
              <div
                key={key}
                data-day-index={dayIdx}
                onPointerDown={(e) => handleColumnPointerDown(dayIdx, e)}
                className="relative cursor-cell border-r border-gcal-border"
                style={{ height: `${HOUR_HEIGHT * 24}px` }}
              >
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="border-b border-gcal-border/60"
                    style={{ height: `${HOUR_HEIGHT}px` }}
                  />
                ))}

                {isToday && <NowLine now={now} />}

                {layoutEvents(dayEvents).map(
                  ({ ev, topPct, heightPct, col, colCount }) => (
                    <EventBlock
                      key={ev.id}
                      ev={ev}
                      topPct={topPct}
                      heightPct={heightPct}
                      col={col}
                      colCount={colCount}
                      isDragging={drag?.id === ev.id}
                      modified={isModified(store, ev.id) || isLocalId(ev.id)}
                      onPointerDown={(e) => startMoveDrag(ev, e)}
                      onResizeHandlePointerDown={(e) => startResizeDrag(ev, e)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (drag?.moved) return;
                        onOpenEvent(ev);
                      }}
                    />
                  ),
                )}
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
        <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-[#C62B6B]" />
        <div className="h-px w-full bg-[#C62B6B]" />
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

type EventBlockProps = Laid & {
  isDragging: boolean;
  modified: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onResizeHandlePointerDown: (e: React.PointerEvent) => void;
  onClick: (e: React.MouseEvent) => void;
};

function EventBlock({
  ev,
  topPct,
  heightPct,
  col,
  colCount,
  isDragging,
  modified,
  onPointerDown,
  onResizeHandlePointerDown,
  onClick,
}: EventBlockProps) {
  const widthPct = 100 / colCount;
  const leftPct = col * widthPct;
  const style = CATEGORY_STYLE[getTaskCategory(ev.colorId)];

  return (
    <div
      data-event-block
      onPointerDown={onPointerDown}
      onClick={onClick}
      className={`absolute cursor-grab overflow-hidden rounded-md px-1.5 py-1 text-[11px] shadow-sm hover:opacity-95 active:cursor-grabbing ${style.blockBg} ${style.blockText} ${
        isDragging ? `opacity-80 ring-2 ${style.dragRing}` : ""
      }`}
      style={{
        top: `${topPct}%`,
        height: `${heightPct}%`,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
      }}
      title={`${ev.summary}\n${ev.start ? format(new Date(ev.start), "p") : ""} – ${ev.end ? format(new Date(ev.end), "p") : ""}`}
    >
      <div className="flex items-center gap-1 truncate font-medium">
        {modified && (
          <span
            className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-yellow-300"
            title="Modified locally"
          />
        )}
        <span className="truncate">{ev.summary}</span>
      </div>
      {ev.start && ev.end && (
        <div className="truncate opacity-90">
          {format(new Date(ev.start), "p")} – {format(new Date(ev.end), "p")}
        </div>
      )}
      {/* Resize handle */}
      <div
        onPointerDown={onResizeHandlePointerDown}
        className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize"
        title="Drag to resize"
      />
    </div>
  );
}

function getLocalOffset(): string {
  const offset = -new Date().getTimezoneOffset() / 60;
  const sign = offset >= 0 ? "+" : "-";
  return `${sign}${Math.abs(offset).toString().padStart(2, "0")}`;
}
