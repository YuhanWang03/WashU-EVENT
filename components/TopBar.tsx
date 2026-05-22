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
          className="rounded p-2 text-gcal-subtext hover:bg-[#EDE8FF]"
          aria-label="Menu"
        >
          <MenuIcon />
        </button>
        <div className="flex items-center gap-2">
          <CadenceLogo size={32} />
          <span className="text-xl font-semibold text-gcal-text">Cadence</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToday}
          className="rounded-full border border-gcal-border px-4 py-1.5 text-sm text-gcal-text hover:bg-[#EDE8FF]"
        >
          Today
        </button>
        <button
          onClick={onPrev}
          className="rounded-full p-2 text-gcal-subtext hover:bg-[#EDE8FF]"
          aria-label="Previous week"
        >
          <ChevronLeft />
        </button>
        <button
          onClick={onNext}
          className="rounded-full p-2 text-gcal-subtext hover:bg-[#EDE8FF]"
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
              : "border-gcal-border text-gcal-text hover:bg-[#EDE8FF]"
          }`}
          title={chatOpen ? "Hide Cadence chat" : "Show Cadence chat"}
        >
          <SparkleIcon />
          Cadence
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
function CadenceLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7B57D2"/>
          <stop offset="100%" stopColor="#D63484"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="url(#lg)" />
      {/* Stylised "C" arc */}
      <path
        d="M22 9C19.5 7.4 16 7.4 13.5 9C11 10.6 9.5 13.2 9.5 16C9.5 18.8 11 21.4 13.5 23C16 24.6 19.5 24.6 22 23"
        stroke="white"
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Rhythm / cadence dots */}
      <circle cx="24.5" cy="12" r="1.6" fill="white" />
      <circle cx="24.5" cy="16" r="1.6" fill="white" />
      <circle cx="24.5" cy="20" r="1.6" fill="white" />
    </svg>
  );
}
