/**
 * Maps Google Calendar colorId to the four task categories.
 *
 * colorId  Name        Hex        → Category
 * ───────  ──────────  ─────────  ─────────────────────────────────────────
 *  "10"    Tomato      #d50000    red    — Fixed, must attend
 *  "11"    Tomato alt  #d50000    red
 *  "6"     Tangerine   #f5511d    red
 *  "4"     Flamingo    #e67c73    red
 *  "2"     Sage        #33b679    green  — Optional fixed-time
 *  "9"     Basil       #0f9d58    green
 *  "3"     Grape       #8e24aa    purple — Fitness & medium-high exercise
 *  "7"     Peacock     #039be5    blue   — Freely scheduled tasks
 *  "8"     Blueberry   #3f51b5    blue
 *  "1"     Lavender    #7986cb    blue
 */

export type TaskCategory = "red" | "green" | "purple" | "blue" | "unknown";

const COLOR_ID_MAP: Record<string, TaskCategory> = {
  "11": "red",
  "10": "red",
  "6":  "red",
  "4":  "red",
  "2":  "green",
  "9":  "green",
  "3":  "purple",
  "1":  "blue",
  "7":  "blue",
  "8":  "blue",
};

export function getTaskCategory(
  colorId: string | null | undefined,
): TaskCategory {
  if (!colorId) return "unknown";
  return COLOR_ID_MAP[colorId] ?? "unknown";
}

export type CategoryStyle = {
  label: string;
  /** Tailwind bg class for the timed event block */
  blockBg: string;
  /** Tailwind text class for the event block */
  blockText: string;
  /** Tailwind ring class shown while dragging */
  dragRing: string;
  /** Tailwind bg + text classes for all-day chip */
  chipBg: string;
  chipText: string;
  /** Hex colour for dot indicators / pills */
  dot: string;
};

export const CATEGORY_STYLE: Record<TaskCategory, CategoryStyle> = {
  red: {
    label: "Fixed",
    blockBg: "bg-red-500",
    blockText: "text-white",
    dragRing: "ring-red-300",
    chipBg: "bg-red-100",
    chipText: "text-red-800",
    dot: "#ef4444",
  },
  green: {
    label: "Optional",
    blockBg: "bg-green-500",
    blockText: "text-white",
    dragRing: "ring-green-300",
    chipBg: "bg-green-100",
    chipText: "text-green-800",
    dot: "#22c55e",
  },
  purple: {
    label: "Exercise",
    blockBg: "bg-purple-500",
    blockText: "text-white",
    dragRing: "ring-purple-300",
    chipBg: "bg-purple-100",
    chipText: "text-purple-800",
    dot: "#a855f7",
  },
  blue: {
    label: "Flexible",
    blockBg: "bg-blue-500",
    blockText: "text-white",
    dragRing: "ring-blue-300",
    chipBg: "bg-blue-100",
    chipText: "text-blue-800",
    dot: "#3b82f6",
  },
  unknown: {
    // Keep the original gcal-blue so untagged events look unchanged.
    label: "Other",
    blockBg: "bg-[#1a73e8]",
    blockText: "text-white",
    dragRing: "ring-blue-300",
    chipBg: "bg-blue-100",
    chipText: "text-blue-800",
    dot: "#1a73e8",
  },
};

/**
 * Short label used in schedule text sent to Gemini, e.g. "[cat=red]".
 * Gemini uses this to apply category-specific scheduling rules.
 */
export function categoryTag(colorId: string | null | undefined): string {
  return `[cat=${getTaskCategory(colorId)}]`;
}
