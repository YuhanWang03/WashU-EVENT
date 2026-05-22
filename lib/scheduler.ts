"use client";

/**
 * Core scheduling engine.
 *
 * Responsibilities:
 *  1. Build an occupied timeline from red + green events (+ invisible buffers).
 *  2. Find free slots within the schedulable window (08:00 – 22:00).
 *  3. Prioritise blue tasks by deadline urgency × difficulty × state fit.
 *  4. Place tasks greedily, splitting blocks > MAX_BLOCK_MIN and inserting
 *     invisible breaks between every task.
 *
 * Output is a CalendarAction[] that CalendarApp applies through the same
 * handleApplyActions path used by Gemini — no separate code path needed.
 */

import { addMinutes, format, isSameDay, differenceInCalendarDays } from "date-fns";
import type { CalendarEvent } from "@/lib/types";
import type { StateLevel } from "@/lib/types";
import { getTaskCategory } from "@/lib/taskCategory";
import { isLocalId } from "@/lib/localStore";
import type { CalendarAction } from "@/lib/actions";

// ── Constants ────────────────────────────────────────────────────────────────

const DAY_START_HOUR = 6;   // 06:00 wake up — schedulable window start
const DAY_END_HOUR   = 24;  // 00:00 (midnight) sleep — schedulable window end

/** Maximum single-block duration for blue tasks (minutes). */
const MAX_BLOCK_MIN = 90;

/** Reduced max block when deadline is near + task is hard (minutes). */
const MAX_BLOCK_NEAR_DEADLINE_MIN = 60;

/**
 * Invisible break inserted AFTER every non-red/green block (minutes).
 * Gemini never sees these — they are subtracted from available time only.
 */
const BREAK_AFTER: Record<StateLevel, number> = {
  peak:   5,
  good:   10,
  normal: 15,
  low:    20,
};

/**
 * Invisible buffer reserved BEFORE every red task (minutes).
 * Gives the user time to travel and mentally prepare.
 */
const RED_BUFFER: Record<StateLevel, number> = {
  peak:   15,
  good:   15,
  normal: 20,
  low:    30,
};

// ── Types ────────────────────────────────────────────────────────────────────

/** A half-open time interval [start, end). */
type Interval = { start: Date; end: Date };

export type TaskDifficulty = 1 | 2 | 3 | 4; // 1=easy … 4=very hard

export type BlueTaskType =
  | "homework"
  | "project"
  | "review"
  | "reading"
  | "exam_prep"
  | "interview_prep";

/**
 * A user-defined blue task that needs to be placed in the schedule.
 * Stored separately from CalendarEvent (see lib/blueTaskStore.ts).
 */
export type BlueTask = {
  id: string;
  summary: string;
  type: BlueTaskType;
  /** Total estimated work time in minutes. */
  estimatedMinutes: number;
  difficulty: TaskDifficulty;
  /** ISO date string (YYYY-MM-DD) or null if no deadline. */
  deadline: string | null;
  /** Optional notes: "very hard", "tedious", etc. */
  notes?: string;
  /** If true, this task has already been fully placed for the target day. */
  placed?: boolean;
};

export type SchedulerInput = {
  /** The day to schedule (local midnight). */
  targetDate: Date;
  /** All merged events visible in the week view. */
  events: CalendarEvent[];
  /** Blue tasks that still need time allocated. */
  pendingTasks: BlueTask[];
  stateLevel: StateLevel;
  /**
   * If provided, slots before this time are skipped (mid-day rescheduling).
   * Defaults to targetDate 08:00 when omitted.
   */
  currentTime?: Date;
};

export type SchedulerOutput = {
  actions: CalendarAction[];
  /** Human-readable notes about decisions made (shown in chat). */
  notes: string[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(DAY_START_HOUR, 0, 0, 0);
  const end = new Date(date);
  end.setHours(DAY_END_HOUR, 0, 0, 0);
  return { start, end };
}

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** Merge overlapping / adjacent intervals and sort ascending. */
function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  const merged: Interval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur.start <= last.end) {
      if (cur.end > last.end) last.end = cur.end;
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

/**
 * Subtract occupied intervals from [windowStart, windowEnd].
 * Returns the remaining free intervals.
 */
function freeSlots(
  occupied: Interval[],
  windowStart: Date,
  windowEnd: Date,
): Interval[] {
  const merged = mergeIntervals(
    occupied.filter((iv) => iv.end > windowStart && iv.start < windowEnd),
  );

  const free: Interval[] = [];
  let cursor = new Date(windowStart);

  for (const iv of merged) {
    const ivStart = iv.start < windowStart ? windowStart : iv.start;
    if (ivStart > cursor) {
      free.push({ start: new Date(cursor), end: new Date(ivStart) });
    }
    if (iv.end > cursor) cursor = new Date(iv.end);
  }

  if (cursor < windowEnd) {
    free.push({ start: new Date(cursor), end: new Date(windowEnd) });
  }

  return free.filter((f) => f.end.getTime() - f.start.getTime() >= 15 * 60000);
}

/** Minutes available in a slot. */
function slotMinutes(slot: Interval): number {
  return (slot.end.getTime() - slot.start.getTime()) / 60000;
}

/** Format a Date as "HH:MM" (24-hour local time). */
function toHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Format a Date as "YYYY-MM-DD" (local date). */
function toYMD(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

// ── Deadline urgency scoring ─────────────────────────────────────────────────

/**
 * Returns an urgency multiplier based on how close the deadline is.
 * Higher = more urgent.
 */
function deadlineUrgency(deadline: string | null, targetDate: Date): number {
  if (!deadline) return 1;
  const dl = new Date(deadline);
  const daysLeft = differenceInCalendarDays(dl, targetDate);
  if (daysLeft <= 0) return 5; // overdue / due today
  if (daysLeft === 1) return 4;
  if (daysLeft <= 3) return 3;
  if (daysLeft <= 7) return 2;
  return 1;
}

/**
 * Compute a priority score for a blue task.
 * Higher = place sooner / earlier in the day.
 */
function taskPriority(
  task: BlueTask,
  stateLevel: StateLevel,
  targetDate: Date,
): number {
  const urgency = deadlineUrgency(task.deadline, targetDate);
  const diffScore = task.difficulty; // 1–4

  // Exam/interview prep always gets a bonus.
  const typeBonus =
    task.type === "exam_prep" || task.type === "interview_prep" ? 2 : 0;

  // When state is low, prefer easy tasks (invert difficulty weight).
  const stateFactor =
    stateLevel === "low" || stateLevel === "normal"
      ? 5 - task.difficulty  // easy tasks get higher score when fatigued
      : diffScore;           // hard tasks preferred when energised

  return urgency * 2 + stateFactor + typeBonus;
}

// ── Block sizing ─────────────────────────────────────────────────────────────

/**
 * Determine the maximum block size for a task given state and deadline.
 */
function maxBlockFor(task: BlueTask, targetDate: Date): number {
  const urgency = deadlineUrgency(task.deadline, targetDate);
  // Near deadline (≤ 2 days) + hard task → shorter, more focused blocks.
  if (urgency >= 4 && task.difficulty >= 3) return MAX_BLOCK_NEAR_DEADLINE_MIN;
  return MAX_BLOCK_MIN;
}

/**
 * Split a task's total estimated time into work segments (minutes each),
 * respecting the max block size.  Returns an array of segment durations.
 */
function splitIntoBlocks(task: BlueTask, targetDate: Date): number[] {
  const maxBlock = maxBlockFor(task, targetDate);
  const total = task.estimatedMinutes;
  if (total <= maxBlock) return [total];

  const blocks: number[] = [];
  let remaining = total;
  while (remaining > 0) {
    const seg = Math.min(remaining, maxBlock);
    // Avoid leaving a tiny tail < 15 min — absorb into previous block.
    if (remaining - seg > 0 && remaining - seg < 15 && blocks.length > 0) {
      blocks[blocks.length - 1] += remaining - seg;
      break;
    }
    blocks.push(seg);
    remaining -= seg;
  }
  return blocks;
}

// ── Preferred time windows by difficulty + state ─────────────────────────────

/**
 * For a given state level and task difficulty, return the preferred start
 * hour range [earliestHour, latestStartHour].
 */
function preferredWindow(
  difficulty: TaskDifficulty,
  stateLevel: StateLevel,
): { earliest: number; latest: number } {
  // Peak / Good: hard work in the morning, easy in the afternoon/evening.
  if (stateLevel === "peak") {
    if (difficulty >= 3) return { earliest: 6,  latest: 12 };
    if (difficulty === 2) return { earliest: 13, latest: 17 };
    return                       { earliest: 14, latest: 23 };
  }
  if (stateLevel === "good") {
    if (difficulty >= 3) return { earliest: 7,  latest: 12 };
    if (difficulty === 2) return { earliest: 13, latest: 17 };
    return                       { earliest: 14, latest: 23 };
  }
  // Normal / Low: avoid very early morning.
  if (stateLevel === "normal") {
    if (difficulty >= 3) return { earliest: 9, latest: 13 };
    return                       { earliest: 9, latest: 22 };
  }
  // Low: everything pushed later; minimise cognitive load.
  return { earliest: 10, latest: 22 };
}

// ── Main scheduling function ─────────────────────────────────────────────────

export function scheduleDay(input: SchedulerInput): SchedulerOutput {
  const { targetDate, events, pendingTasks, stateLevel, currentTime } = input;
  const { start: dayStart, end: dayEnd } = dayBounds(targetDate);

  // Effective window start: now (if mid-day) or 08:00.
  const windowStart =
    currentTime && currentTime > dayStart ? currentTime : dayStart;

  const actions: CalendarAction[] = [];
  const notes: string[] = [];

  // Filter to events that fall on targetDate.
  const todayEvents = events.filter((ev) => {
    const s = toDate(ev.start);
    return s && isSameDay(s, targetDate);
  });

  // ── 1. Build occupied intervals (red + green + already-placed blue/local) ──

  const occupied: Interval[] = [];

  for (const ev of todayEvents) {
    const cat = getTaskCategory(ev.colorId);
    const s = toDate(ev.start);
    const e = toDate(ev.end);
    if (!s || !e) continue;

    if (cat === "red") {
      // Reserve the event itself + pre-buffer.
      const bufferMin = RED_BUFFER[stateLevel];
      const bufferStart = addMinutes(s, -bufferMin);
      occupied.push({
        start: bufferStart < dayStart ? dayStart : bufferStart,
        end: e,
      });
    } else if (cat === "green") {
      occupied.push({ start: s, end: e });
    } else if (cat === "blue" || isLocalId(ev.id)) {
      // Already-placed blue tasks and locally-created events block their slots
      // so the scheduler never double-books or overlaps with them.
      occupied.push({ start: s, end: e });
    }
  }

  // ── 2. Prioritise and place blue tasks ──────────────────────────────────

  if (pendingTasks.length === 0) {
    return { actions, notes };
  }

  const sorted = [...pendingTasks].sort(
    (a, b) =>
      taskPriority(b, stateLevel, targetDate) -
      taskPriority(a, stateLevel, targetDate),
  );

  for (const task of sorted) {
    const blocks = splitIntoBlocks(task, targetDate);
    const pref = preferredWindow(task.difficulty, stateLevel);
    const breakAfter = BREAK_AFTER[stateLevel];

    for (const blockMin of blocks) {
      // Required slot: block + break.
      const needed = blockMin + breakAfter;

      // Find the best free slot: prefer the preferred window, fall back to any.
      const free = freeSlots(merged(occupied), windowStart, dayEnd);

      let placed = false;

      // First pass: try preferred window.
      for (const slot of free) {
        const slotStart = slot.start;
        const slotEndMax = slot.end;

        // Check preferred hour range.
        const slotHour = slotStart.getHours();
        if (slotHour < pref.earliest || slotHour > pref.latest) continue;

        if (slotMinutes(slot) >= needed) {
          const blockEnd = addMinutes(slotStart, blockMin);
          const occupiedEnd = addMinutes(slotStart, needed);

          actions.push({
            type: "create",
            summary: task.summary,
            day: toYMD(slotStart),
            start: toHHMM(slotStart),
            end: toHHMM(blockEnd),
          });

          occupied.push({ start: slotStart, end: occupiedEnd });
          placed = true;
          break;
        }
      }

      // Second pass: any free slot.
      if (!placed) {
        for (const slot of freeSlots(merged(occupied), windowStart, dayEnd)) {
          if (slotMinutes(slot) >= needed) {
            const blockEnd = addMinutes(slot.start, blockMin);
            const occupiedEnd = addMinutes(slot.start, needed);

            actions.push({
              type: "create",
              summary: task.summary,
              day: toYMD(slot.start),
              start: toHHMM(slot.start),
              end: toHHMM(blockEnd),
            });

            occupied.push({ start: slot.start, end: occupiedEnd });
            placed = true;
            break;
          }
        }
      }

      if (!placed) {
        notes.push(
          `⚠ Could not find a slot for "${task.summary}" (${blockMin} min) on ${format(targetDate, "MMM d")}.`,
        );
      }
    }
  }

  return { actions, notes };
}

/** Helper: merge + sort intervals (avoids importing mergeIntervals above). */
function merged(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  const result: Interval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = result[result.length - 1];
    const cur = sorted[i];
    if (cur.start <= last.end) {
      if (cur.end > last.end) last.end = cur.end;
    } else {
      result.push({ ...cur });
    }
  }
  return result;
}

// ── Two-day scheduling (today + tomorrow) ────────────────────────────────────

/**
 * Schedule both today and tomorrow. Tasks that can't fit today are
 * automatically rolled over to tomorrow.
 */
export function scheduleTwoDays(
  today: Date,
  events: CalendarEvent[],
  pendingTasks: BlueTask[],
  stateLevel: StateLevel,
  currentTime?: Date,
): SchedulerOutput {
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  // Schedule today first.
  const todayResult = scheduleDay({
    targetDate: today,
    events,
    pendingTasks,
    stateLevel,
    currentTime,
  });

  // Determine which tasks still have unplaced time after today.
  // (Simplified: tasks that received fewer create actions than their block
  //  count are considered partially unplaced and rolled to tomorrow.)
  const placedSummaries = new Set(
    todayResult.actions
      .filter((a) => a.type === "create")
      .map((a) => (a as any).summary as string),
  );

  const rollover = pendingTasks.filter(
    (t) => !placedSummaries.has(t.summary),
  );

  if (rollover.length === 0) {
    return todayResult;
  }

  const tomorrowResult = scheduleDay({
    targetDate: tomorrow,
    events,
    pendingTasks: rollover,
    stateLevel,
  });

  return {
    actions: [...todayResult.actions, ...tomorrowResult.actions],
    notes: [
      ...todayResult.notes,
      rollover.length > 0
        ? `Rolled ${rollover.length} task(s) to tomorrow: ${rollover.map((t) => t.summary).join(", ")}.`
        : "",
      ...tomorrowResult.notes,
    ].filter(Boolean),
  };
}
