"use client";

import { signOut, useSession } from "next-auth/react";

type Props = {
  monthLabel: string;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleChat: () => void;
  chatOpen: boolean;
  onAddTask: () => void;
};

export default function TopBar({
  monthLabel,
  onToday,
  onPrev,
  onNext,
  onToggleChat,
  chatOpen,
  onAddTask,
}: Props) {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <header className="flex h-14 items-center justify-between border-b border-gcal-border px-4">
      <div className="flex items-center gap-3">
        <button
          className="rounded p-2 text-gcal-subtext hover:bg-gray-100"
          aria-label="Menu"
        >
          <MenuIcon />
        </button>
        <div className="flex items-center gap-2">
          <CalendarMark />
          <span className="text-xl text-gcal-text">Calendar</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToday}
          className="rounded-full border border-gcal-border px-4 py-1.5 text-sm text-gcal-text hover:bg-gray-50"
        >
          Today
        </button>
        <button
          onClick={onPrev}
          className="rounded-full p-2 text-gcal-subtext hover:bg-gray-100"
          aria-label="Previous week"
        >
          <ChevronLeft />
        </button>
        <button
          onClick={onNext}
          className="rounded-full p-2 text-gcal-subtext hover:bg-gray-100"
          aria-label="Next week"
        >
          <ChevronRight />
        </button>
        <h1 className="ml-2 text-xl text-gcal-text">{monthLabel}</h1>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onAddTask}
          className="flex items-center gap-1.5 rounded-full bg-gcal-blue px-3 py-1.5 text-sm text-white shadow-sm hover:bg-gcal-bluehover"
          title="Add a task"
        >
          <PlusIcon />
          <span className="hidden sm:inline">Add Task</span>
        </button>
        <span className="hidden text-sm text-gcal-subtext md:inline">Week</span>
        <button
          onClick={onToggleChat}
          className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition ${
            chatOpen
              ? "border-gcal-blue text-gcal-blue"
              : "border-gcal-border text-gcal-text hover:bg-gray-50"
          }`}
          title={chatOpen ? "Hide Gemini chat" : "Show Gemini chat"}
        >
          <SparkleIcon />
          Gemini
        </button>
        {user && (
          <button
            onClick={() => signOut()}
            className="ml-1 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gcal-blue text-xs font-medium text-white"
            title={`Sign out ${user.email ?? ""}`}
          >
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name ?? "user"}
                className="h-8 w-8 rounded-full"
              />
            ) : (
              (user.name ?? user.email ?? "U").slice(0, 1).toUpperCase()
            )}
          </button>
        )}
      </div>
    </header>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
    </svg>
  );
}
function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z" />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.39 5.86L20 10l-5.61 2.14L12 18l-2.39-5.86L4 10l5.61-2.14z" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" />
    </svg>
  );
}
function CalendarMark() {
  const day = new Date().getDate();
  return (
    <div className="relative flex h-8 w-8 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-gcal-border">
      <span className="text-[11px] font-semibold text-gcal-blue">{day}</span>
    </div>
  );
}
