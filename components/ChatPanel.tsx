"use client";

import { useEffect, useRef, useState } from "react";
import type { CalendarEvent, ChatMessage } from "@/lib/types";

type Props = {
  events: CalendarEvent[];
  viewLabel: string;
  onClose: () => void;
};

export default function ChatPanel({ events, viewLabel, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;
    setInput("");
    setError(null);

    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setSending(true);

    try {
      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          events: events.map((e) => ({
            summary: e.summary,
            start: e.start,
            end: e.end,
            location: e.location,
            description: e.description,
            allDay: e.allDay,
          })),
          viewLabel,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `status ${res.status}`);
      }
      setMessages((prev) => [...prev, { role: "model", content: data.reply }]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const suggestions = [
    "Summarize the main points on this page",
    "What meetings do I have today?",
    "Find a 30 minute free slot this week",
  ];

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
          <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
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

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gcal-text"
        }`}
      >
        {message.content}
      </div>
    </div>
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
