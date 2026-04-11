"use client";

import type { CalendarEvent } from "@/lib/types";

/**
 * Local "scratch layer" on top of Google Calendar data.
 *
 * Google Calendar is always treated as read-only. Any edit, drag, resize,
 * or new event the user makes is stored here in localStorage and merged
 * with the Google events at render time. Nothing ever gets written back
 * to Google.
 *
 * The store has two parts:
 *   1. `overrides` — keyed by Google event id. Holds the patched fields
 *      (summary, start, end, location, description) or a `deleted` marker.
 *   2. `locals`    — brand new events the user created in the app, with
 *      a synthetic id prefixed `local_`.
 *
 * The store is keyed per user so two different Google accounts on the
 * same browser don't see each other's edits.
 */

export type LocalOverride = {
  summary?: string;
  start?: string;
  end?: string;
  location?: string;
  description?: string;
  allDay?: boolean;
  deleted?: boolean;
};

export type LocalEvent = CalendarEvent & { _local: true };

export type LocalStore = {
  overrides: Record<string, LocalOverride>;
  locals: LocalEvent[];
};

const STORAGE_PREFIX = "washu-event-local::";

function keyFor(userKey: string): string {
  return `${STORAGE_PREFIX}${userKey || "anonymous"}`;
}

export function emptyStore(): LocalStore {
  return { overrides: {}, locals: [] };
}

export function loadStore(userKey: string): LocalStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(keyFor(userKey));
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    return {
      overrides: parsed.overrides ?? {},
      locals: Array.isArray(parsed.locals) ? parsed.locals : [],
    };
  } catch {
    return emptyStore();
  }
}

export function saveStore(userKey: string, store: LocalStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(keyFor(userKey), JSON.stringify(store));
  } catch {
    // quota / disabled — silently ignore
  }
}

export function isLocalId(id: string): boolean {
  return id.startsWith("local_");
}

export function newLocalId(): string {
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Produce the merged set of events to render: Google events patched by
 * overrides, plus brand-new local events. Events marked deleted are
 * dropped. Pure function — safe to call in useMemo.
 */
export function mergeEvents(
  googleEvents: CalendarEvent[],
  store: LocalStore,
): CalendarEvent[] {
  const out: CalendarEvent[] = [];

  for (const ev of googleEvents) {
    const ovr = store.overrides[ev.id];
    if (ovr?.deleted) continue;
    if (ovr) {
      out.push({
        ...ev,
        summary: ovr.summary ?? ev.summary,
        start: ovr.start ?? ev.start,
        end: ovr.end ?? ev.end,
        location: ovr.location ?? ev.location,
        description: ovr.description ?? ev.description,
        allDay: ovr.allDay ?? ev.allDay,
      });
    } else {
      out.push(ev);
    }
  }

  for (const local of store.locals) out.push(local);

  return out;
}

/**
 * Apply a patch to an event by id. If the event is a Google event, the
 * patch is recorded in `overrides`. If it's a local event, the entry in
 * `locals` is updated in place.
 */
export function patchEvent(
  store: LocalStore,
  id: string,
  patch: LocalOverride,
): LocalStore {
  if (isLocalId(id)) {
    return {
      ...store,
      locals: store.locals.map((l) =>
        l.id === id
          ? ({
              ...l,
              summary: patch.summary ?? l.summary,
              start: patch.start ?? l.start,
              end: patch.end ?? l.end,
              location: patch.location ?? l.location,
              description: patch.description ?? l.description,
              allDay: patch.allDay ?? l.allDay,
            } as LocalEvent)
          : l,
      ),
    };
  }

  const existing = store.overrides[id] ?? {};
  return {
    ...store,
    overrides: {
      ...store.overrides,
      [id]: { ...existing, ...patch },
    },
  };
}

export function deleteEvent(store: LocalStore, id: string): LocalStore {
  if (isLocalId(id)) {
    return { ...store, locals: store.locals.filter((l) => l.id !== id) };
  }
  return {
    ...store,
    overrides: {
      ...store.overrides,
      [id]: { ...(store.overrides[id] ?? {}), deleted: true },
    },
  };
}

export function addLocalEvent(
  store: LocalStore,
  input: {
    summary: string;
    start: string;
    end: string;
    description?: string;
    location?: string;
  },
): { store: LocalStore; event: LocalEvent } {
  const event: LocalEvent = {
    id: newLocalId(),
    summary: input.summary || "(new event)",
    start: input.start,
    end: input.end,
    description: input.description ?? "",
    location: input.location ?? "",
    allDay: false,
    htmlLink: null,
    colorId: null,
    _local: true,
  };
  return { store: { ...store, locals: [...store.locals, event] }, event };
}

/** True if the event id has been modified locally (for UI indicator). */
export function isModified(store: LocalStore, id: string): boolean {
  if (isLocalId(id)) return true;
  const ovr = store.overrides[id];
  if (!ovr) return false;
  return Boolean(
    ovr.summary ??
      ovr.start ??
      ovr.end ??
      ovr.location ??
      ovr.description ??
      ovr.allDay,
  );
}
