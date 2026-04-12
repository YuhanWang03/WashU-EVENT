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
    blockBg:  "bg-[#c4836c]",   // dusty terracotta
    blockText: "text-white",
    dragRing: "ring-[#d4a898]",
    chipBg:   "bg-[#f2e4dc]",
    chipText: "text-[#8a4535]",
    dot: "#c4836c",
  },
  green: {
    label: "Optional",
    blockBg:  "bg-[#8aaa8a]",   // sage green
    blockText: "text-white",
    dragRing: "ring-[#aac4aa]",
    chipBg:   "bg-[#e2eedf]",
    chipText: "text-[#4a6a4a]",
    dot: "#8aaa8a",
  },
  purple: {
    label: "Exercise",
    blockBg:  "bg-[#a08ab8]",   // dusty mauve
    blockText: "text-white",
    dragRing: "ring-[#c0aad0]",
    chipBg:   "bg-[#e8e0f0]",
    chipText: "text-[#5a4070]",
    dot: "#a08ab8",
  },
  blue: {
    label: "Flexible",
    blockBg:  "bg-[#8fa8b8]",   // dusty steel blue
    blockText: "text-white",
    dragRing: "ring-[#afc8d8]",
    chipBg:   "bg-[#dce6ef]",
    chipText: "text-[#3a5870]",
    dot: "#8fa8b8",
  },
  unknown: {
    label: "Other",
    blockBg:  "bg-[#a8a098]",   // warm gray
    blockText: "text-white",
    dragRing: "ring-[#c4bcb4]",
    chipBg:   "bg-[#edeae6]",
    chipText: "text-[#6a6058]",
    dot: "#a8a098",
  },
};

/**
 * Short label used in schedule text sent to Gemini, e.g. "[cat=red]".
 * Gemini uses this to apply category-specific scheduling rules.
 */
export function categoryTag(colorId: string | null | undefined): string {
  return `[cat=${getTaskCategory(colorId)}]`;
}
