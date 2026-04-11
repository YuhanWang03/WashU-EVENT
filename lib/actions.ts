"use client";

/**
 * Structured "tool calls" that Gemini can emit in its reply. The model
 * outputs a `<calendar-actions>...</calendar-actions>` block containing
 * a JSON object with an `actions` array; the client parses it and
 * dispatches each one to the local scratch store.
 *
 * Times are in LOCAL wall time — the model says "2026-04-11 09:00" and
 * we interpret that as 9 AM in the browser's timezone.
 */

export type CalendarAction =
  | {
      type: "move";
      id: string;
      day?: string; // YYYY-MM-DD, optional if start/end are full ISO
      start: string;
      end: string;
    }
  | {
      type: "rename";
      id: string;
      summary: string;
    }
  | {
      type: "delete";
      id: string;
    }
  | {
      type: "create";
      summary: string;
      day: string;
      start: string;
      end: string;
    };

const BLOCK_RE = /<calendar-actions>([\s\S]*?)<\/calendar-actions>/i;

/**
 * Extract the action block (if any) from the model's reply.
 *
 * Returns the cleaned display text with the raw block removed, plus the
 * parsed actions. If parsing fails, actions is empty and the original
 * reply is returned unchanged.
 */
export function parseActionBlock(reply: string): {
  cleaned: string;
  actions: CalendarAction[];
} {
  const m = reply.match(BLOCK_RE);
  if (!m) return { cleaned: reply, actions: [] };

  let parsed: any = null;
  try {
    // Strip code fences if the model wrapped the JSON in ``` blocks.
    let raw = m[1].trim();
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
    parsed = JSON.parse(raw);
  } catch {
    return { cleaned: reply, actions: [] };
  }

  const actions: CalendarAction[] = Array.isArray(parsed?.actions)
    ? parsed.actions.filter((a: any) => a && typeof a.type === "string")
    : [];

  const cleaned = reply.replace(BLOCK_RE, "").trim();
  return { cleaned, actions };
}

/**
 * Compose a JS Date from a day ("YYYY-MM-DD") + time ("HH:MM" 24h or
 * "H:MM AM/PM"). Interpreted in the browser's local timezone.
 *
 * Also accepts full ISO strings in which case day/time is ignored.
 */
export function composeLocalDate(
  day: string | undefined,
  time: string,
): Date {
  // Full ISO?
  if (/^\d{4}-\d{2}-\d{2}T/.test(time)) {
    return new Date(time);
  }

  let d: { y: number; m: number; d: number };
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const [y, mo, da] = day.split("-").map(Number);
    d = { y, m: mo, d: da };
  } else {
    const now = new Date();
    d = { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
  }

  // Accept "HH:MM", "H:MM", "H:MM AM", "H:MM PM", "HH:MM:SS"
  const t = time.trim().toUpperCase();
  let hour = 0;
  let minute = 0;
  const ampm = /AM|PM/.exec(t)?.[0];
  const clean = t.replace(/AM|PM/, "").trim();
  const parts = clean.split(":").map((p) => Number(p));
  hour = parts[0] || 0;
  minute = parts[1] || 0;
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  return new Date(d.y, d.m - 1, d.d, hour, minute, 0, 0);
}

export function summarizeActions(actions: CalendarAction[]): string {
  if (actions.length === 0) return "";
  const counts: Record<string, number> = {};
  for (const a of actions) counts[a.type] = (counts[a.type] ?? 0) + 1;
  const parts: string[] = [];
  if (counts.move) parts.push(`moved ${counts.move}`);
  if (counts.rename) parts.push(`renamed ${counts.rename}`);
  if (counts.delete) parts.push(`deleted ${counts.delete}`);
  if (counts.create) parts.push(`created ${counts.create}`);
  return `Applied: ${parts.join(", ")} event${actions.length === 1 ? "" : "s"}`;
}
