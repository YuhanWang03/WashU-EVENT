"use client";

import type { StateLevel } from "@/lib/types";

/**
 * Basic health summary returned by /api/fit/summary.
 * `available: false` means the user hasn't granted Fit scopes (or auth error).
 */
export type HealthSummary =
  | {
      available: true;
      sleepMinutes: number | null;
      sleepQuality: "good" | "ok" | "poor" | "unknown";
      steps: number | null;
      activeMinutes: number | null;
    }
  | { available: false; reason?: string };

/**
 * Enhanced health metrics returned by /api/fit/detail.
 * Every field can be null when the device doesn't support it.
 */
export type DetailedHealth = {
  lightSleepMinutes: number | null;
  deepSleepMinutes: number | null;
  remSleepMinutes: number | null;
  restingHeartRate: number | null; // BPM
  hrv: number | null;              // RMSSD ms
};

// ── StateLevel scoring ───────────────────────────────────────────────────────

/**
 * Compute an overall state level from combined health metrics.
 *
 * Scoring (0–100):
 *   Sleep duration   0–40 pts
 *   Sleep quality    0–20 pts  (stage-based when available, label otherwise)
 *   HRV              0–20 pts  (neutral 10 when unavailable)
 *   Resting HR       0–20 pts  (neutral 10 when unavailable)
 *
 * Thresholds:
 *   80–100 → peak   60–79 → good   40–59 → normal   0–39 → low
 */
export function computeStateLevel(
  summary: HealthSummary | null,
  detail: DetailedHealth | null,
): StateLevel {
  if (!summary || !summary.available) return "normal";

  let score = 0;

  // ── Sleep duration (0–40 pts) ──────────────────────────────────────────
  const mins = summary.sleepMinutes ?? 0;
  if (mins >= 8 * 60) score += 40;
  else if (mins >= 7 * 60) score += 35;
  else if (mins >= 6 * 60) score += 25;
  else if (mins >= 5 * 60) score += 15;
  else score += 0;

  // ── Sleep quality (0–20 pts) ───────────────────────────────────────────
  if (
    detail &&
    detail.deepSleepMinutes !== null &&
    detail.remSleepMinutes !== null
  ) {
    // Stage-based scoring (most accurate).
    if (detail.deepSleepMinutes >= 90) score += 10;
    else if (detail.deepSleepMinutes >= 60) score += 7;
    else if (detail.deepSleepMinutes >= 30) score += 4;

    if (detail.remSleepMinutes >= 90) score += 10;
    else if (detail.remSleepMinutes >= 60) score += 7;
    else if (detail.remSleepMinutes >= 30) score += 4;
  } else {
    // Fall back to the qualitative label from /api/fit/summary.
    const q = summary.sleepQuality;
    if (q === "good") score += 18;
    else if (q === "ok") score += 12;
    else if (q === "poor") score += 4;
    else score += 10; // unknown → neutral
  }

  // ── HRV (0–20 pts) ────────────────────────────────────────────────────
  if (detail?.hrv !== null && detail?.hrv !== undefined) {
    const hrv = detail.hrv;
    // Higher RMSSD = better recovery. Rough population thresholds:
    //   >70 ms excellent, 50–70 good, 30–50 average, <30 poor.
    if (hrv >= 70) score += 20;
    else if (hrv >= 50) score += 15;
    else if (hrv >= 30) score += 8;
    else score += 2;
  } else {
    score += 10; // unavailable → neutral
  }

  // ── Resting heart rate (0–20 pts) ─────────────────────────────────────
  if (detail?.restingHeartRate !== null && detail?.restingHeartRate !== undefined) {
    const rhr = detail.restingHeartRate;
    // Lower RHR generally indicates better cardiovascular fitness / recovery.
    if (rhr < 55) score += 20;
    else if (rhr < 65) score += 15;
    else if (rhr < 75) score += 8;
    else score += 2;
  } else {
    score += 10; // unavailable → neutral
  }

  if (score >= 80) return "peak";
  if (score >= 60) return "good";
  if (score >= 40) return "normal";
  return "low";
}

// ── Text builders (sent to Gemini as context) ────────────────────────────────

export function buildHealthText(
  summary: HealthSummary | null,
  detail?: DetailedHealth | null,
  stateLevel?: StateLevel | null,
): string {
  if (!summary || !summary.available) {
    return "- Overall state: NORMAL (default — health data not yet loaded)\n- Use standard NORMAL scheduling rules. Do not mention health data status to the user.";
  }

  const lines: string[] = [];

  // Overall state — the most important signal for the scheduler.
  if (stateLevel) {
    const stateDesc: Record<StateLevel, string> = {
      peak:   "Peak — schedule hardest tasks in the morning",
      good:   "Good — normal scheduling, hard tasks preferred in the morning",
      normal: "Normal — reduce cognitive load, keep easier tasks",
      low:    "Low — protect red-task readiness, minimise blue tasks",
    };
    lines.push(`- Overall state: ${stateLevel.toUpperCase()} (${stateDesc[stateLevel]})`);
  }

  // Sleep duration + quality.
  if (typeof summary.sleepMinutes === "number" && summary.sleepMinutes > 0) {
    const h = Math.floor(summary.sleepMinutes / 60);
    const m = summary.sleepMinutes % 60;
    lines.push(
      `- Last night's sleep: ${h}h ${m}m (quality: ${summary.sleepQuality})`,
    );
  } else {
    lines.push("- Last night's sleep: (no data)");
  }

  // Sleep stages (when available).
  if (detail && (detail.deepSleepMinutes !== null || detail.remSleepMinutes !== null)) {
    const deep = detail.deepSleepMinutes ?? 0;
    const rem  = detail.remSleepMinutes  ?? 0;
    const light = detail.lightSleepMinutes ?? 0;
    lines.push(`- Sleep stages: ${deep}m deep / ${rem}m REM / ${light}m light`);
  }

  // HRV.
  if (detail?.hrv !== null && detail?.hrv !== undefined) {
    lines.push(`- HRV (RMSSD): ${detail.hrv} ms`);
  }

  // Resting heart rate.
  if (detail?.restingHeartRate !== null && detail?.restingHeartRate !== undefined) {
    lines.push(`- Resting heart rate: ${detail.restingHeartRate} BPM`);
  }

  // Activity.
  if (typeof summary.steps === "number") {
    lines.push(`- Yesterday's steps: ${summary.steps.toLocaleString()}`);
  }
  if (typeof summary.activeMinutes === "number") {
    lines.push(`- Yesterday's active minutes: ${summary.activeMinutes}`);
  }

  return lines.join("\n");
}

/**
 * Short pill label for the chat panel's health context pill.
 */
export function healthPillLabel(
  summary: HealthSummary | null,
  stateLevel?: StateLevel | null,
): string | null {
  if (!summary || !summary.available) return null;

  if (stateLevel) {
    const emoji: Record<StateLevel, string> = {
      peak: "⚡",
      good: "✓",
      normal: "~",
      low: "↓",
    };
    if (typeof summary.sleepMinutes === "number" && summary.sleepMinutes > 0) {
      const h = Math.floor(summary.sleepMinutes / 60);
      const m = summary.sleepMinutes % 60;
      return `${emoji[stateLevel]} ${stateLevel} · slept ${h}h${m ? ` ${m}m` : ""}`;
    }
    return `${emoji[stateLevel]} ${stateLevel}`;
  }

  if (typeof summary.sleepMinutes !== "number" || summary.sleepMinutes <= 0) {
    return null;
  }
  const h = Math.floor(summary.sleepMinutes / 60);
  const m = summary.sleepMinutes % 60;
  return `slept ${h}h${m ? ` ${m}m` : ""} · ${summary.sleepQuality}`;
}
