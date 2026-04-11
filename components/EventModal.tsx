"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import type { CalendarEvent } from "@/lib/types";

type Props = {
  open: boolean;
  event: CalendarEvent | null;
  isNew?: boolean;
  onClose: () => void;
  onSave: (patch: {
    summary: string;
    start: string;
    end: string;
    description?: string;
    location?: string;
  }) => void;
  onDelete?: () => void;
};

function toInputValue(iso: string | null): string {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
}

function fromInputValue(v: string): string {
  // Treat the input as local time and return an ISO string.
  if (!v) return new Date().toISOString();
  const d = new Date(v);
  return d.toISOString();
}

export default function EventModal({
  open,
  event,
  isNew = false,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [summary, setSummary] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!event) return;
    setSummary(event.summary ?? "");
    setStart(toInputValue(event.start));
    setEnd(toInputValue(event.end));
    setLocation(event.location ?? "");
    setDescription(event.description ?? "");
  }, [event?.id, event?.start, event?.end, event?.summary, event?.location, event?.description]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !event) return null;

  const submit = () => {
    if (!start || !end) return;
    onSave({
      summary: summary.trim() || "(no title)",
      start: fromInputValue(start),
      end: fromInputValue(end),
      location: location.trim(),
      description: description.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gcal-text">
            {isNew ? "New event" : "Edit event"}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gcal-subtext hover:bg-gray-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="mb-4 text-[11px] text-gcal-subtext">
          Changes only affect this web app — your Google Calendar stays
          untouched.
        </p>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-gcal-subtext">Title</span>
          <input
            autoFocus
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="w-full rounded-md border border-gcal-border px-3 py-2 text-sm outline-none focus:border-gcal-blue"
            placeholder="Add title"
          />
        </label>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs text-gcal-subtext">Start</span>
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-md border border-gcal-border px-2 py-2 text-sm outline-none focus:border-gcal-blue"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-gcal-subtext">End</span>
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full rounded-md border border-gcal-border px-2 py-2 text-sm outline-none focus:border-gcal-blue"
            />
          </label>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-gcal-subtext">Location</span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-md border border-gcal-border px-3 py-2 text-sm outline-none focus:border-gcal-blue"
            placeholder="Add location"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs text-gcal-subtext">
            Description
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-md border border-gcal-border px-3 py-2 text-sm outline-none focus:border-gcal-blue"
            placeholder="Add notes"
          />
        </label>

        <div className="flex items-center justify-between">
          <div>
            {onDelete && !isNew && (
              <button
                onClick={onDelete}
                className="rounded-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                Delete (locally)
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-full px-4 py-1.5 text-sm text-gcal-text hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              className="rounded-full bg-gcal-blue px-4 py-1.5 text-sm text-white hover:bg-gcal-bluehover"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
