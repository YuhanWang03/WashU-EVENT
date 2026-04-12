"use client";

import { useMemo } from "react";
import { format, isSameDay, addMinutes } from "date-fns";
import type { CalendarEvent } from "@/lib/types";
import type { StateLevel } from "@/lib/types";
import type { HealthSummary, DetailedHealth } from "@/lib/health";
import { getTaskCategory } from "@/lib/taskCategory";

// ── Types ────────────────────────────────────────────────────────────────────

type NapRecommendation = {
  start: Date;
  end: Date;
  durationMin: number;
  kind: "power" | "cycle" | "rest";
  message: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  stateLevel: StateLevel | null;
  health: HealthSummary | null;
  detailedHealth: DetailedHealth | null;
  events: CalendarEvent[];
  schedulerNotes: string[];
  deferredPurpleNames: string[];
  onAddNap: (start: Date, end: Date) => void;
};

// ── Nap recommendation logic ─────────────────────────────────────────────────

/**
 * Find the best nap slot for today.
 * Prefers 13:00–16:00 window; looks for the first free slot ≥ 20 min.
 */
function findNapSlot(
  events: CalendarEvent[],
  stateLevel: StateLevel | null,
): NapRecommendation | null {
  if (stateLevel !== "low" && stateLevel !== "normal") return null;

  const today = new Date();
  const napWindowStart = new Date(today);
  napWindowStart.setHours(13, 0, 0, 0);
  const napWindowEnd = new Date(today);
  napWindowEnd.setHours(17, 0, 0, 0);

  // Effective start: now if we're already past 13:00.
  const effectiveStart =
    new Date() > napWindowStart ? new Date() : napWindowStart;
  if (effectiveStart >= napWindowEnd) return null;

  // Collect occupied intervals from today's events.
  type Iv = { start: Date; end: Date };
  const occupied: Iv[] = [];
  for (const ev of events) {
    if (!ev.start || !ev.end) continue;
    const s = new Date(ev.start);
    const e = new Date(ev.end);
    if (!isSameDay(s, today)) continue;
    if (e <= effectiveStart || s >= napWindowEnd) continue;
    occupied.push({ start: s, end: e });
  }
  occupied.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Find free slots.
  const free: Iv[] = [];
  let cursor = new Date(effectiveStart);
  for (const iv of occupied) {
    if (iv.start > cursor) free.push({ start: new Date(cursor), end: iv.start });
    if (iv.end > cursor) cursor = new Date(iv.end);
  }
  if (cursor < napWindowEnd) free.push({ start: new Date(cursor), end: napWindowEnd });

  // Pick the first slot with ≥ 20 min.
  for (const slot of free) {
    const mins = (slot.end.getTime() - slot.start.getTime()) / 60000;
    if (mins < 20) continue;

    let durationMin: number;
    let kind: NapRecommendation["kind"];
    let message: string;

    if (mins >= 60) {
      durationMin = 90;
      kind = "cycle";
      message =
        "90-min full sleep cycle — wake up feeling significantly more alert.";
    } else if (mins >= 30) {
      durationMin = 30;
      kind = "power";
      message =
        "30-min power nap — stays in light sleep so you wake up clear-headed.";
    } else {
      durationMin = 20;
      kind = "power";
      message =
        "20-min power nap — the shortest effective rest window.";
    }

    const napEnd = addMinutes(slot.start, Math.min(durationMin, mins));
    return { start: slot.start, end: napEnd, durationMin: Math.min(durationMin, mins), kind, message };
  }

  return null;
}

// ── State level config ───────────────────────────────────────────────────────

const STATE_CONFIG: Record<
  StateLevel,
  { label: string; icon: string; bg: string; text: string; border: string; tagline: string }
> = {
  peak: {
    label: "PEAK",
    icon: "⚡",
    bg: "bg-[#EDE7FF]",
    text: "text-[#4A2FA0]",
    border: "border-[#B39AE8]",
    tagline: "Excellent condition — tackle your hardest work first.",
  },
  good: {
    label: "GOOD",
    icon: "✓",
    bg: "bg-[#D8F0DC]",
    text: "text-[#1A5C2A]",
    border: "border-[#aac4aa]",
    tagline: "Well-rested — hard tasks in the morning, easier ones after lunch.",
  },
  normal: {
    label: "NORMAL",
    icon: "~",
    bg: "bg-[#F5EEFF]",
    text: "text-[#49454F]",
    border: "border-[#CAC4D0]",
    tagline: "Moderate energy — keep tasks manageable and take your breaks.",
  },
  low: {
    label: "LOW",
    icon: "↓",
    bg: "bg-[#FFD9EE]",
    text: "text-[#8B1A45]",
    border: "border-[#E87FAD]",
    tagline: "Low energy today — protect your red tasks, rest when you can.",
  },
};

// ── Recovery suggestions ─────────────────────────────────────────────────────

function recoveryTips(
  stateLevel: StateLevel | null,
  events: CalendarEvent[],
): string[] {
  if (!stateLevel || stateLevel === "peak") return [];

  const tips: string[] = [];
  const today = new Date();

  // Check for red tasks today.
  const redToday = events.filter((ev) => {
    if (getTaskCategory(ev.colorId) !== "red") return false;
    const s = ev.start ? new Date(ev.start) : null;
    return s && isSameDay(s, today);
  });

  if (stateLevel === "low" || stateLevel === "normal") {
    tips.push("Stay hydrated — drink water before each task block.");
    tips.push("Step outside for 5–10 min before any cognitively demanding work.");
  }

  if (stateLevel === "low") {
    tips.push("Avoid caffeine after 14:00 to protect tonight's sleep.");
    if (redToday.length > 0) {
      const names = redToday.map((e) => e.summary).join(", ");
      tips.push(
        `You have mandatory events today (${names}). Give yourself extra buffer time to arrive calm and prepared.`,
      );
    }
  }

  return tips;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DailyBriefing({
  open,
  onClose,
  stateLevel,
  health,
  detailedHealth,
  events,
  schedulerNotes,
  deferredPurpleNames,
  onAddNap,
}: Props) {
  const nap = useMemo(
    () => findNapSlot(events, stateLevel),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stateLevel, events.length],
  );

  const tips = useMemo(
    () => recoveryTips(stateLevel, events),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stateLevel, events.length],
  );

  if (!open) return null;

  const cfg = stateLevel ? STATE_CONFIG[stateLevel] : null;
  const summaryData = health && health.available ? health : null;
  const today = new Date();

  // Greeting.
  const hour = today.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Compute visible scheduler notes (filter warnings only for display).
  const planNotes = schedulerNotes.filter((n) => !n.startsWith("⚠"));
  const warnings  = schedulerNotes.filter((n) => n.startsWith("⚠"));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-gcal-panel shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div
          className={`rounded-t-2xl px-5 pt-5 pb-4 ${cfg?.bg ?? "bg-[#edeae6]"}`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gcal-subtext mb-0.5">
                {format(today, "EEEE, MMMM d")}
              </p>
              <h2 className="text-lg font-semibold text-gcal-text">
                {greeting}!
              </h2>
              {cfg && (
                <div
                  className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text} border ${cfg.border}`}
                >
                  <span>{cfg.icon}</span>
                  {cfg.label} state
                </div>
              )}
              {cfg && (
                <p className={`mt-1.5 text-sm ${cfg.text} opacity-90`}>
                  {cfg.tagline}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-gcal-subtext hover:bg-black/10"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Health metrics */}
          {summaryData && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gcal-subtext mb-2">
                Health Metrics
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {/* Sleep */}
                {typeof summaryData.sleepMinutes === "number" && (
                  <MetricCard
                    icon="💤"
                    label="Sleep"
                    value={`${Math.floor(summaryData.sleepMinutes / 60)}h ${summaryData.sleepMinutes % 60}m`}
                    sub={summaryData.sleepQuality}
                    highlight={
                      summaryData.sleepQuality === "poor" ||
                      summaryData.sleepMinutes < 5 * 60
                    }
                  />
                )}
                {/* Sleep stages */}
                {detailedHealth?.deepSleepMinutes !== null &&
                  detailedHealth?.deepSleepMinutes !== undefined && (
                    <MetricCard
                      icon="🌙"
                      label="Deep / REM"
                      value={`${detailedHealth.deepSleepMinutes}m / ${detailedHealth.remSleepMinutes ?? "—"}m`}
                    />
                  )}
                {/* HRV */}
                {detailedHealth?.hrv !== null &&
                  detailedHealth?.hrv !== undefined && (
                    <MetricCard
                      icon="📈"
                      label="HRV"
                      value={`${detailedHealth.hrv} ms`}
                    />
                  )}
                {/* Resting HR */}
                {detailedHealth?.restingHeartRate !== null &&
                  detailedHealth?.restingHeartRate !== undefined && (
                    <MetricCard
                      icon="❤️"
                      label="Resting HR"
                      value={`${detailedHealth.restingHeartRate} bpm`}
                    />
                  )}
                {/* Steps */}
                {typeof summaryData.steps === "number" && (
                  <MetricCard
                    icon="👟"
                    label="Yesterday's steps"
                    value={summaryData.steps.toLocaleString()}
                  />
                )}
              </div>
            </section>
          )}

          {/* Nap recommendation */}
          {nap && (
            <section className="rounded-xl border border-[#B39AE8] bg-[#EDE7FF] px-4 py-3">
              <div className="flex items-start gap-2">
                <span className="text-lg">😴</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#4A2FA0]">
                    Nap recommended:{" "}
                    {format(nap.start, "h:mm a")} – {format(nap.end, "h:mm a")} ({nap.durationMin} min)
                  </p>
                  <p className="mt-0.5 text-xs text-[#6B50C0]">{nap.message}</p>
                </div>
              </div>
            </section>
          )}

          {/* Recovery tips */}
          {tips.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gcal-subtext mb-2">
                Recommendations
              </h3>
              <ul className="space-y-1.5">
                {tips.map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-sm text-gcal-text">
                    <span className="mt-0.5 text-[#7B57D2] flex-shrink-0">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Today's plan from scheduler */}
          {(planNotes.length > 0 || deferredPurpleNames.length > 0) && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gcal-subtext mb-2">
                Today's Plan
              </h3>
              <ul className="space-y-1.5">
                {planNotes.map((note) => (
                  <li key={note} className="flex items-start gap-2 text-sm text-gcal-text">
                    <span className="text-[#4F8055] flex-shrink-0 mt-0.5">✓</span>
                    {note}
                  </li>
                ))}
                {deferredPurpleNames.map((name) => (
                  <li key={name} className="flex items-start gap-2 text-sm text-gcal-text">
                    <span className="text-[#7B57D2] flex-shrink-0 mt-0.5">↷</span>
                    <span>
                      <strong>{name}</strong> deferred — not recommended given your current state.
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Unplaced task warnings */}
          {warnings.length > 0 && (
            <section className="rounded-xl border border-[#E87FAD] bg-[#FFD9EE] px-4 py-3">
              <h3 className="text-xs font-semibold text-[#8B1A45] mb-1">
                Scheduling Warnings
              </h3>
              {warnings.map((w) => (
                <p key={w} className="text-xs text-[#8B1A45]">{w}</p>
              ))}
            </section>
          )}
        </div>

        {/* Footer buttons */}
        <div className="border-t border-gcal-border px-5 py-3 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-1.5 text-sm text-gcal-subtext hover:bg-[#EDE8FF]"
          >
            Dismiss
          </button>
          {nap ? (
            <button
              onClick={() => onAddNap(nap.start, nap.end)}
              className="rounded-full bg-[#7B57D2] px-4 py-1.5 text-sm text-white hover:bg-[#6A48C0]"
            >
              Accept &amp; Add Nap
            </button>
          ) : (
            <button
              onClick={onClose}
              className="rounded-full bg-gcal-blue px-4 py-1.5 text-sm text-white hover:bg-gcal-bluehover"
            >
              Looks good
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        highlight
          ? "border-red-200 bg-red-50"
          : "border-gray-100 bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-sm">{icon}</span>
        <span className="text-[10px] text-gray-500 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className={`text-sm font-semibold ${highlight ? "text-red-700" : "text-gray-800"}`}>
        {value}
      </p>
      {sub && (
        <p className={`text-[10px] ${highlight ? "text-red-500" : "text-gray-400"}`}>
          {sub}
        </p>
      )}
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
