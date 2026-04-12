"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";

type Props = {
  anchorDate: Date;
  setAnchorDate: (d: Date) => void;
};

export default function Sidebar({ anchorDate, setAnchorDate }: Props) {
  const [miniMonth, setMiniMonth] = useState<Date>(() => anchorDate);
  const { data: session } = useSession();

  const miniGrid = useMemo(() => buildMiniMonth(miniMonth), [miniMonth]);
  const today = new Date();

  // Derive the "primary calendar" row label from the signed-in user.
  // Google Calendar shows the account holder's display name here; before
  // this fix we were hardcoding "YK G" so every user saw the same label.
  const userLabel =
    displayNameFor(session?.user?.name, session?.user?.email) || "My calendar";
  const userColor = colorFor(session?.user?.email ?? "anonymous");

  return (
    <aside className="flex w-[240px] shrink-0 flex-col bg-white px-3 py-3">
      <button className="mb-3 flex w-[140px] items-center gap-3 rounded-full border border-gcal-border bg-white px-4 py-3 text-sm font-medium text-gcal-text shadow-sm hover:shadow">
        <PlusIcon />
        Create
      </button>

      {/* mini calendar */}
      <div className="mb-4 select-none">
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-sm text-gcal-text">
            {format(miniMonth, "MMMM yyyy")}
          </span>
          <div className="flex">
            <button
              onClick={() => setMiniMonth((d) => addMonths(d, -1))}
              className="rounded p-1 text-gcal-subtext hover:bg-gray-100"
              aria-label="Previous month"
            >
              <SmallChevron dir="left" />
            </button>
            <button
              onClick={() => setMiniMonth((d) => addMonths(d, 1))}
              className="rounded p-1 text-gcal-subtext hover:bg-gray-100"
              aria-label="Next month"
            >
              <SmallChevron dir="right" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-0 text-center text-[11px] text-gcal-subtext">
          {"M T W T F S S".split(" ").map((d, i) => (
            <div key={i} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 text-center text-[11px]">
          {miniGrid.map((d, i) => {
            const isToday = isSameDay(d, today);
            const isSelected = isSameDay(d, anchorDate);
            const dim = !isSameMonth(d, miniMonth);
            return (
              <button
                key={i}
                onClick={() => setAnchorDate(d)}
                className={`relative flex h-7 items-center justify-center rounded-full transition ${
                  isSelected
                    ? "bg-gcal-blue text-white"
                    : isToday
                      ? "text-gcal-blue"
                      : dim
                        ? "text-gray-300"
                        : "text-gcal-text hover:bg-gray-100"
                }`}
              >
                {format(d, "d")}
              </button>
            );
          })}
        </div>
      </div>

      {/* search for people */}
      <div className="mb-4 flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm text-gcal-subtext">
        <SearchIcon />
        <span>Search for people</span>
      </div>

      {/* booking pages */}
      <SectionHeader title="Booking pages" action={<PlusIcon size={14} />} />

      <div className="mb-4" />

      <SectionHeader title="My calendars" />
      <CalendarRow color={userColor} label={userLabel} checked />
      <CalendarRow color="#33b679" label="Birthdays" />
      <CalendarRow color="#f4511e" label="Tasks" />

      <div className="mt-4" />
      <SectionHeader title="Other calendars" action={<PlusIcon size={14} />} />

      <div className="mt-auto pt-4 text-[11px] text-gcal-subtext">
        Terms · Privacy
      </div>
    </aside>
  );
}

/**
 * Prefer Google display name ("Yikai Ge"), fall back to the local part of
 * the email ("yikai.ge"), finally null.
 */
function displayNameFor(
  name: string | null | undefined,
  email: string | null | undefined,
): string | null {
  if (name && name.trim()) return name.trim();
  if (email && email.includes("@")) return email.split("@")[0];
  return null;
}

/**
 * Deterministic hue from an email so two different accounts get two
 * different primary-calendar colors instead of a shared blue.
 */
function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const palette = [
    "#1a73e8", // Google blue
    "#d93025", // red
    "#e37400", // orange
    "#188038", // green
    "#8e24aa", // purple
    "#00796b", // teal
    "#c2185b", // pink
    "#5f6368", // graphite
  ];
  return palette[h % palette.length];
}

function buildMiniMonth(date: Date): Date[] {
  const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  // If the last row is fully next month, we still keep 6 weeks for consistency.
  endOfMonth(date); // no-op, ensures date-fns import used
  return days;
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-2 py-1 text-sm text-gcal-text">
      <span>{title}</span>
      <div className="flex items-center gap-1 text-gcal-subtext">
        {action}
        <SmallChevron dir="down" />
      </div>
    </div>
  );
}

function CalendarRow({
  color,
  label,
  checked = false,
}: {
  color: string;
  label: string;
  checked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-gcal-text hover:bg-gray-50">
      <span
        className="flex h-4 w-4 items-center justify-center rounded-sm"
        style={{
          backgroundColor: checked ? color : "transparent",
          border: `2px solid ${color}`,
        }}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
            <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        )}
      </span>
      {label}
    </label>
  );
}

function PlusIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.5 14h-.79l-.28-.27a6.471 6.471 0 0 0 1.48-5.34C15.32 5.41 12.57 3 9.29 3 5.71 3 2.82 5.89 2.82 9.47c0 3.28 2.41 6.03 5.39 6.62a6.471 6.471 0 0 0 5.34-1.48l.27.28v.79l4.25 4.24 1.27-1.27L15.5 14zm-6.21 0c-2.49 0-4.5-2.01-4.5-4.5S6.8 5 9.29 5s4.5 2.01 4.5 4.5S11.78 14 9.29 14z" />
    </svg>
  );
}
function SmallChevron({ dir }: { dir: "left" | "right" | "down" }) {
  const transform =
    dir === "left"
      ? "rotate(90)"
      : dir === "right"
        ? "rotate(-90)"
        : "rotate(0)";
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ transform }}
    >
      <path d="M7 10l5 5 5-5z" />
    </svg>
  );
}
