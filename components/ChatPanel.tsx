"use client";

import { useEffect, useRef, useState } from "react";
import type { CalendarEvent, ChatMessage } from "@/lib/types";
import {
  parseActionBlock,
  sanitizeActions,
  summarizeActions,
  type CalendarAction,
} from "@/lib/actions";
import { healthPillLabel, type HealthSummary } from "@/lib/health";
import type { StateLevel } from "@/lib/types";

type ChatMessageWithActions = ChatMessage & { appliedNote?: string };

type Props = {
  events: CalendarEvent[];
  viewLabel: string;
  scheduleText: string;
  healthText?: string;
  health?: HealthSummary | null;
  stateLevel?: StateLevel | null;
  onClose: () => void;
  onApplyActions?: (actions: CalendarAction[]) => number;
  /** Called when Gemini emits a reschedule signal. */
  onReschedule?: (elapsedMinutes?: number) => void;
};

export default function ChatPanel({
  events,
  viewLabel,
  scheduleText,
  healthText,
  health,
  stateLevel,
  onClose,
  onApplyActions,
  onReschedule,
}: Props) {
  const [messages, setMessages] = useState<ChatMessageWithActions[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const send = async (textOverride?: string, opts?: { isRetry?: boolean }) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;
    if (!opts?.isRetry) setInput("");
    setError(null);
    setLastPrompt(text);

    // On a retry we don't want to double-append the user bubble.
    const next: ChatMessage[] = opts?.isRetry
      ? messages
      : [...messages, { role: "user", content: text }];
    if (!opts?.isRetry) setMessages(next);
    setSending(true);

    try {
      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: opts?.isRetry
            ? [...messages, { role: "user", content: text }]
            : next,
          events: events.map((e) => ({
            summary: e.summary,
            start: e.start,
            end: e.end,
            location: e.location,
            description: e.description,
            allDay: e.allDay,
          })),
          viewLabel,
          scheduleText,
          healthText,
          currentTime: new Date().toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const code = data?.error ?? `status ${res.status}`;
        const detail = data?.detail ? `: ${String(data.detail)}` : "";
        // Friendly message for the common overload case.
        if (code === "gemini_overloaded") {
          throw new Error(
            "Gemini is temporarily overloaded. Tap Retry to try again.",
          );
        }
        throw new Error(`${code}${detail}`.slice(0, 320));
      }

      // Pull out any <calendar-actions> block, apply them, and show a
      // cleaned reply (without the raw JSON) plus an "Applied: ..." note.
      const { cleaned, actions } = parseActionBlock(data.reply ?? "");

      // Separate the special reschedule signal from regular calendar actions.
      const rescheduleAction = actions.find((a) => a.type === "reschedule") as
        | { type: "reschedule"; elapsedMinutes?: number }
        | undefined;
      const calendarActions = sanitizeActions(
        actions.filter((a) => a.type !== "reschedule"),
      );

      let appliedNote: string | undefined;
      if (calendarActions.length > 0 && onApplyActions) {
        const n = onApplyActions(calendarActions);
        if (n > 0) appliedNote = summarizeActions(calendarActions.slice(0, n));
      }

      // Trigger full re-optimisation if Gemini requested it.
      if (rescheduleAction && onReschedule) {
        onReschedule(rescheduleAction.elapsedMinutes);
      }
      setMessages((prev) => [
        ...prev,
        { role: "model", content: cleaned || data.reply, appliedNote },
      ]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const retry = () => {
    if (!lastPrompt || sending) return;
    send(lastPrompt, { isRetry: true });
  };

  const suggestions = [
    "Optimize today based on my health",
    "Going to eat",
    "Going home",
    "I'm back",
    "Find a free slot this week",
  ];

  const healthPill = healthPillLabel(health ?? null, stateLevel);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gcal-border px-4 py-3">
        <div className="flex items-center gap-2">
          <SparkleIcon />
          <span className="text-sm font-medium text-gcal-text">Gemini</span>
        </div>
        <div className="flex items-center gap-1 text-gcal-subtext">
          <button
            className="rounded p-1 hover:bg-gray-100"
            title="More"
            aria-label="More"
          >
            <DotsIcon />
          </button>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-gray-100"
            title="Close"
            aria-label="Close chat panel"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="px-4 py-2 text-[11px] text-gcal-subtext">
        Gemini is an AI and may make mistakes. Your conversations are
        personalized.
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="scroll-thin flex-1 space-y-3 overflow-y-auto px-4 py-3"
      >
        {messages.length === 0 && (
          <div className="space-y-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-gcal-subtext">
              Today
            </div>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full rounded-xl border border-gcal-border bg-orange-50 px-3 py-2 text-left text-sm text-gcal-text transition hover:bg-orange-100"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}

        {sending && (
          <div className="flex gap-2 text-sm text-gcal-subtext">
            <Dot /> <Dot /> <Dot />
          </div>
        )}

        {error && (
          <div className="flex items-start justify-between gap-2 rounded bg-red-50 px-3 py-2 text-xs text-red-700">
            <span className="flex-1 whitespace-pre-wrap break-words">
              {error}
            </span>
            {lastPrompt && (
              <button
                onClick={retry}
                className="shrink-0 rounded-full border border-red-300 px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-100"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      {/* Context pill */}
      <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-gcal-border bg-white px-3 py-2 text-xs text-gcal-text shadow-sm">
        <CalendarPillIcon />
        <div className="flex-1 truncate">
          {viewLabel || "Google Calendar"}
        </div>
        <span className="text-[11px] text-gcal-subtext">+{events.length} events</span>
      </div>

      {healthPill && (
        <div
          className={`mx-4 mb-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow-sm ${
            stateLevel === "peak"
              ? "border-blue-200 bg-blue-50 text-blue-800"
              : stateLevel === "good"
                ? "border-green-200 bg-green-50 text-green-800"
                : stateLevel === "low"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-gcal-border bg-white text-gcal-text"
          }`}
        >
          <HeartIcon />
          <div className="flex-1 truncate">Health</div>
          <span className="text-[11px] font-medium">{healthPill}</span>
        </div>
      )}

      {/* Composer */}
      <div className="mx-3 mb-3 rounded-2xl border border-gcal-border bg-white shadow-sm">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Message Gemini or @ mention a tab"
          rows={2}
          className="max-h-32 w-full resize-none rounded-2xl bg-transparent px-4 pt-3 text-sm text-gcal-text placeholder:text-gcal-subtext focus:outline-none"
        />
        <div className="flex items-center justify-between px-2 pb-2">
          <button className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-gcal-subtext hover:bg-gray-100">
            <PlusIcon />
            Smart
            <SmallChevron />
          </button>
          <button
            onClick={() => send()}
            disabled={sending || !input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-white shadow transition disabled:opacity-50"
            aria-label="Send"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessageWithActions }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] space-y-2 rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          isUser ? "bg-blue-600 text-white" : "bg-gray-100 text-gcal-text"
        }`}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
        {message.appliedNote && (
          <div className="flex items-center gap-1.5 rounded-md bg-green-100 px-2 py-1 text-[11px] font-medium text-green-800">
            <CheckIcon />
            {message.appliedNote}
          </div>
        )}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  );
}

function Dot() {
  return (
    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-gcal-subtext" />
  );
}

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#1a73e8">
      <path d="M12 2l2.39 5.86L20 10l-5.61 2.14L12 18l-2.39-5.86L4 10l5.61-2.14z" />
    </svg>
  );
}
function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" />
    </svg>
  );
}
function SmallChevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 10l5 5 5-5z" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
    </svg>
  );
}
function CalendarPillIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#1a73e8">
      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-2 .9-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
    </svg>
  );
}
function HeartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#ea4335">
      <path d="M12 21s-7-4.35-9.5-8.5C.5 8.5 3 5 6.5 5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 5 23.5 8.5 21.5 12.5 19 16.65 12 21 12 21z" />
    </svg>
  );
}
