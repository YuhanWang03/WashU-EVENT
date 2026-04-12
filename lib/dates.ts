import {
  addDays,
  addWeeks,
  endOfDay,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
} from "date-fns";

// Week starts on Sunday (weekStartsOn: 0) to match US calendar convention.
export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 0 });
}

export function getWeekDays(date: Date): Date[] {
  const start = getWeekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = startOfDay(getWeekStart(date));
  const end = endOfDay(addDays(start, 6));
  return { start, end };
}

export function formatMonthYear(date: Date): string {
  return format(date, "MMMM yyyy");
}

export function formatDayShort(date: Date): string {
  return format(date, "EEE").toUpperCase();
}

export function formatDayNumber(date: Date): string {
  return format(date, "d");
}

export function formatHourLabel(hour: number): string {
  if (hour === 0) return "";
  const suffix = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}

export function addWeeksSafe(date: Date, n: number): Date {
  return addWeeks(date, n);
}

export { isSameDay };
