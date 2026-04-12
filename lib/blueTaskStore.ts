"use client";

/**
 * Persistent store for blue tasks (Homework, Project, Review, Reading, etc.)
 * Kept separate from the calendar event scratch layer so that task metadata
 * (difficulty, deadline, notes) survives independent of calendar placement.
 *
 * Storage key: "washu-event-tasks::<userKey>"
 */

import type { BlueTask } from "@/lib/scheduler";

const STORAGE_PREFIX = "washu-event-tasks::";

function storageKey(userKey: string): string {
  return `${STORAGE_PREFIX}${userKey || "anonymous"}`;
}

export function loadBlueTasks(userKey: string): BlueTask[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(userKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBlueTasks(userKey: string, tasks: BlueTask[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(userKey), JSON.stringify(tasks));
  } catch {
    // quota exceeded — silently ignore
  }
}

export function addBlueTask(
  tasks: BlueTask[],
  task: Omit<BlueTask, "id">,
): BlueTask[] {
  const newTask: BlueTask = {
    ...task,
    id: `bt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
  };
  return [...tasks, newTask];
}

export function updateBlueTask(
  tasks: BlueTask[],
  id: string,
  patch: Partial<Omit<BlueTask, "id">>,
): BlueTask[] {
  return tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
}

export function removeBlueTask(tasks: BlueTask[], id: string): BlueTask[] {
  return tasks.filter((t) => t.id !== id);
}

/** Mark a task as fully placed so the scheduler skips it. */
export function markPlaced(tasks: BlueTask[], id: string): BlueTask[] {
  return updateBlueTask(tasks, id, { placed: true });
}

/** Clear the placed flag so a task can be rescheduled. */
export function unmarkPlaced(tasks: BlueTask[], id: string): BlueTask[] {
  return updateBlueTask(tasks, id, { placed: false });
}

/**
 * Return only tasks that still need scheduling:
 *  - not yet placed, AND
 *  - deadline is today or in the future (or no deadline)
 */
export function pendingTasks(tasks: BlueTask[], today: Date): BlueTask[] {
  const todayStr = today.toISOString().slice(0, 10);
  return tasks.filter((t) => {
    if (t.placed) return false;
    if (t.deadline && t.deadline < todayStr) return false; // past deadline
    return true;
  });
}
