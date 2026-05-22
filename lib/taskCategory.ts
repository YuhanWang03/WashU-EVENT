/**
 * Maps Google Calendar colorId to the three task categories.
 *
 * colorId  Name        Hex        → Category
 * ───────  ──────────  ─────────  ─────────────────────────────────────────
 *  "10"    Tomato      #d50000    red    — Fixed, must attend
 *  "11"    Tomato alt  #d50000    red
 *  "6"     Tangerine   #f5511d    red
 *  "4"     Flamingo    #e67c73    red
 *  "2"     Sage        #33b679    green  — Optional fixed-time
 *  "9"     Basil       #0f9d58    green
 *  "7"     Peacock     #039be5    blue   — Freely scheduled tasks
 *  "8"     Blueberry   #3f51b5    blue
 *  "1"     Lavender    #7986cb    blue
 */

export type TaskCategory = "red" | "green" | "blue" | "unknown";

const COLOR_ID_MAP: Record<string, TaskCategory> = {
  "11": "red",
  "10": "red",
  "6":  "red",
  "4":  "red",
  "2":  "green",
  "9":  "green",
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
    blockBg:  "bg-[#C62B6B]",   // deep rose / berry
    blockText: "text-white",
    dragRing: "ring-[#E87FAD]",
    chipBg:   "bg-[#FFD9EE]",
    chipText: "text-[#8B1A45]",
    dot: "#C62B6B",
  },
  green: {
    label: "Optional",
    blockBg:  "bg-[#4F8055]",   // forest green
    blockText: "text-white",
    dragRing: "ring-[#8FC496]",
    chipBg:   "bg-[#D8F0DC]",
    chipText: "text-[#1A5C2A]",
    dot: "#4F8055",
  },
  blue: {
    label: "Flexible",
    blockBg:  "bg-[#D63484]",   // hot pink accent
    blockText: "text-white",
    dragRing: "ring-[#F0A0C8]",
    chipBg:   "bg-[#FFE4F4]",
    chipText: "text-[#8B1755]",
    dot: "#D63484",
  },
  unknown: {
    label: "Other",
    blockBg:  "bg-[#6B5F7A]",   // muted purple-gray
    blockText: "text-white",
    dragRing: "ring-[#B0A8BE]",
    chipBg:   "bg-[#EDE8F5]",
    chipText: "text-[#3A2C52]",
    dot: "#6B5F7A",
  },
};

/**
 * Short label used in schedule text sent to Gemini, e.g. "[cat=red]".
 * Gemini uses this to apply category-specific scheduling rules.
 */
export function categoryTag(colorId: string | null | undefined): string {
  return `[cat=${getTaskCategory(colorId)}]`;
}
