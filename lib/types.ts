export type CalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string | null;
  end: string | null;
  allDay?: boolean;
  htmlLink?: string | null;
  colorId?: string | null;
};

export type ChatMessage = {
  role: "user" | "model";
  content: string;
};

/**
 * User's overall state level derived from health metrics.
 * peak  — excellent sleep + HRV, schedule hard tasks in the morning
 * good  — adequate sleep, normal scheduling
 * normal — mild fatigue, reduce cognitive load
 * low   — significant fatigue / poor sleep, protect red tasks, minimize blue tasks
 */
export type StateLevel = "peak" | "good" | "normal" | "low";
