/**
 * Generate golden fixtures for the Python scheduler equivalence tests.
 *
 * Runs the canonical TypeScript scheduler (lib/scheduler.ts) over a set of
 * fixed inputs and writes the inputs + outputs to a JSON file that
 * backend/tests/test_scheduler_equivalence.py asserts the Python port against.
 *
 * All datetimes are local ISO-8601 WITHOUT a timezone suffix, so both the JS
 * `new Date(...)` (local) and Python `datetime.fromisoformat(...)` (naive)
 * interpret them as the same wall-clock instant.
 *
 * Run from the repo root:  npx tsx scripts/gen_scheduler_fixtures.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  scheduleDay,
  scheduleTwoDays,
  type BlueTask,
} from "@/lib/scheduler";
import type { CalendarEvent } from "@/lib/types";

type DayInput = {
  targetDate: string;
  events: CalendarEvent[];
  pendingTasks: BlueTask[];
  currentTime?: string;
};
type TwoDayInput = {
  today: string;
  events: CalendarEvent[];
  pendingTasks: BlueTask[];
  currentTime?: string;
};
type Case =
  | { name: string; kind: "day"; input: DayInput }
  | { name: string; kind: "twoDays"; input: TwoDayInput };

const TARGET = "2026-05-25T00:00:00"; // Monday, local midnight

const ev = (
  id: string,
  start: string,
  end: string,
  colorId: string | null,
  summary = "event",
): CalendarEvent => ({ id, summary, start, end, colorId });

const task = (
  id: string,
  summary: string,
  type: BlueTask["type"],
  estimatedMinutes: number,
  difficulty: BlueTask["difficulty"],
  deadline: string | null = null,
): BlueTask => ({ id, summary, type, estimatedMinutes, difficulty, deadline });

const cases: Case[] = [
  {
    name: "empty-day",
    kind: "day",
    input: { targetDate: TARGET, events: [], pendingTasks: [] },
  },
  {
    name: "single-hard-task-no-events",
    kind: "day",
    input: {
      targetDate: TARGET,
      events: [],
      pendingTasks: [task("t1", "Read paper", "reading", 90, 3)],
    },
  },
  {
    name: "split-into-two-blocks",
    kind: "day",
    input: {
      targetDate: TARGET,
      events: [],
      pendingTasks: [task("t1", "Long essay", "project", 150, 1)],
    },
  },
  {
    name: "red-event-buffer",
    kind: "day",
    input: {
      targetDate: TARGET,
      events: [ev("g1", "2026-05-25T09:00:00", "2026-05-25T10:00:00", "10", "Lecture")],
      pendingTasks: [task("t1", "Problem set", "homework", 60, 3, "2026-05-26")],
    },
  },
  {
    name: "current-time-midday",
    kind: "day",
    input: {
      targetDate: TARGET,
      events: [],
      pendingTasks: [task("t1", "Quick review", "review", 60, 1)],
      currentTime: "2026-05-25T15:30:00",
    },
  },
  {
    name: "priority-ordering",
    kind: "day",
    input: {
      targetDate: TARGET,
      events: [],
      pendingTasks: [
        task("t1", "Low priority", "homework", 60, 1),
        task("t2", "Due today", "homework", 60, 1, "2026-05-25"),
      ],
    },
  },
  {
    name: "green-no-buffer-and-exam-bonus",
    kind: "day",
    input: {
      targetDate: TARGET,
      events: [ev("g1", "2026-05-25T13:00:00", "2026-05-25T14:00:00", "9", "Office hour")],
      pendingTasks: [task("t1", "Exam prep", "exam_prep", 60, 2)],
    },
  },
  {
    name: "local-id-blocks-slot",
    kind: "day",
    input: {
      targetDate: TARGET,
      events: [ev("local_x1", "2026-05-25T10:00:00", "2026-05-25T11:00:00", null, "Nap")],
      pendingTasks: [task("t1", "Study", "homework", 60, 1)],
      currentTime: "2026-05-25T09:30:00",
    },
  },
  {
    name: "two-day-rollover",
    kind: "twoDays",
    input: {
      today: TARGET,
      events: [ev("g1", "2026-05-25T06:00:00", "2026-05-26T00:00:00", "2", "All day busy")],
      pendingTasks: [task("t1", "Overflow", "homework", 60, 1)],
    },
  },
];

const results = cases.map((c) => {
  if (c.kind === "day") {
    const out = scheduleDay({
      targetDate: new Date(c.input.targetDate),
      events: c.input.events,
      pendingTasks: c.input.pendingTasks,
      currentTime: c.input.currentTime
        ? new Date(c.input.currentTime)
        : undefined,
    });
    return { name: c.name, kind: c.kind, input: c.input, expected: out };
  }
  const out = scheduleTwoDays(
    new Date(c.input.today),
    c.input.events,
    c.input.pendingTasks,
    c.input.currentTime ? new Date(c.input.currentTime) : undefined,
  );
  return { name: c.name, kind: c.kind, input: c.input, expected: out };
});

const outPath = join(
  process.cwd(),
  "backend",
  "tests",
  "fixtures",
  "scheduler_cases.json",
);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(results, null, 2)}\n`);
console.log(`Wrote ${results.length} cases to ${outPath}`);
