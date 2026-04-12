"use client";

import { useEffect, useState } from "react";
import type { BlueTask, BlueTaskType, TaskDifficulty } from "@/lib/scheduler";

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (task: Omit<BlueTask, "id">) => void;
};

const TASK_TYPES: { value: BlueTaskType; label: string; icon: string }[] = [
  { value: "homework",       label: "Homework",         icon: "📝" },
  { value: "project",        label: "Project",          icon: "🗂" },
  { value: "review",         label: "Review",           icon: "📖" },
  { value: "reading",        label: "Reading",          icon: "📰" },
  { value: "exam_prep",      label: "Exam Prep",        icon: "📋" },
  { value: "interview_prep", label: "Interview Prep",   icon: "💼" },
];

const DIFFICULTIES: { value: TaskDifficulty; label: string; desc: string; color: string }[] = [
  { value: 1, label: "Easy",      desc: "Light, passive",        color: "bg-[#D8F0DC] text-[#1A5C2A] border-[#aac4aa]" },
  { value: 2, label: "Medium",    desc: "Moderate focus",        color: "bg-[#EDE7FF] text-[#4A2FA0] border-[#B39AE8]" },
  { value: 3, label: "Hard",      desc: "High cognitive load",   color: "bg-[#FFE4F4] text-[#8B1755] border-[#F0A0C8]" },
  { value: 4, label: "Very Hard", desc: "Maximum concentration", color: "bg-[#FFD9EE] text-[#8B1A45] border-[#E87FAD]" },
];

const empty = (): Omit<BlueTask, "id"> => ({
  summary: "",
  type: "homework",
  estimatedMinutes: 60,
  difficulty: 2,
  deadline: null,
  notes: "",
  placed: false,
});

export default function BlueTaskPanel({ open, onClose, onAdd }: Props) {
  const [form, setForm] = useState(empty());
  const [hours, setHours] = useState("1");
  const [mins, setMins] = useState("0");
  const [errors, setErrors] = useState<string[]>([]);

  // Reset form when opened.
  useEffect(() => {
    if (open) {
      setForm(empty());
      setHours("1");
      setMins("0");
      setErrors([]);
    }
  }, [open]);

  // Sync hours/mins → estimatedMinutes.
  useEffect(() => {
    const h = Math.max(0, parseInt(hours) || 0);
    const m = Math.max(0, Math.min(59, parseInt(mins) || 0));
    setForm((f) => ({ ...f, estimatedMinutes: h * 60 + m || 15 }));
  }, [hours, mins]);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const validate = (): boolean => {
    const errs: string[] = [];
    if (!form.summary.trim()) errs.push("Title is required.");
    if (form.estimatedMinutes < 15) errs.push("Estimated time must be at least 15 minutes.");
    setErrors(errs);
    return errs.length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    onAdd({ ...form, summary: form.summary.trim() });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-gcal-panel shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gcal-border px-5 py-4">
          <h2 className="text-base font-semibold text-gcal-text">Add Task</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gcal-subtext hover:bg-[#EDE8FF]"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-5 py-4 space-y-4">

          {/* Task type */}
          <div>
            <span className="mb-2 block text-xs font-medium text-gcal-subtext">Type</span>
            <div className="flex flex-wrap gap-2">
              {TASK_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                    form.type === t.value
                      ? "border-[#B39AE8] bg-[#EDE7FF] text-[#4A2FA0]"
                      : "border-gcal-border text-gcal-text hover:bg-[#EDE8FF]"
                  }`}
                >
                  <span>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gcal-subtext">Title</span>
            <input
              autoFocus
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              className="w-full rounded-lg border border-gcal-border px-3 py-2 text-sm outline-none focus:border-gcal-blue"
              placeholder={`e.g. Algorithms HW3, Research Paper Draft`}
            />
          </label>

          {/* Estimated time */}
          <div>
            <span className="mb-2 block text-xs font-medium text-gcal-subtext">
              Estimated time
            </span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="w-16 rounded-lg border border-gcal-border px-2 py-2 text-sm text-center outline-none focus:border-gcal-blue"
                />
                <span className="text-xs text-gcal-subtext">hr</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={15}
                  value={mins}
                  onChange={(e) => setMins(e.target.value)}
                  className="w-16 rounded-lg border border-gcal-border px-2 py-2 text-sm text-center outline-none focus:border-gcal-blue"
                />
                <span className="text-xs text-gcal-subtext">min</span>
              </div>
              <span className="text-xs text-gcal-subtext">
                {form.estimatedMinutes >= 90
                  ? `→ will be split into ${Math.ceil(form.estimatedMinutes / 90)} × ≤90 min blocks`
                  : `→ single ${form.estimatedMinutes} min block`}
              </span>
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <span className="mb-2 block text-xs font-medium text-gcal-subtext">Difficulty</span>
            <div className="grid grid-cols-4 gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setForm((f) => ({ ...f, difficulty: d.value }))}
                  className={`rounded-lg border px-2 py-2 text-center transition ${
                    form.difficulty === d.value
                      ? d.color + " border-current"
                      : "border-gcal-border text-gcal-subtext hover:bg-[#EDE8FF]"
                  }`}
                >
                  <div className="text-xs font-semibold">{d.label}</div>
                  <div className="text-[10px] opacity-75">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Deadline */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gcal-subtext">
              Deadline <span className="font-normal opacity-60">(optional)</span>
            </span>
            <input
              type="date"
              value={form.deadline ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, deadline: e.target.value || null }))
              }
              className="w-full rounded-lg border border-gcal-border px-3 py-2 text-sm outline-none focus:border-gcal-blue"
            />
          </label>

          {/* Notes */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gcal-subtext">
              Notes <span className="font-normal opacity-60">(optional — e.g. "very tricky", "review Ch 3–5")</span>
            </span>
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full resize-none rounded-lg border border-gcal-border px-3 py-2 text-sm outline-none focus:border-gcal-blue"
              placeholder="Any extra context for the scheduler…"
            />
          </label>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="rounded-lg bg-[#FFD9EE] px-3 py-2 text-xs text-[#8B1A45]">
              {errors.map((e) => <div key={e}>{e}</div>)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gcal-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-1.5 text-sm text-gcal-text hover:bg-[#EDE8FF]"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="rounded-full bg-gcal-blue px-4 py-1.5 text-sm text-white hover:bg-gcal-bluehover"
          >
            Add &amp; Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  );
}
