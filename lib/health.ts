"use client";

/**
 * Shape of the payload returned by /api/fit/summary. `available: false`
 * means the user didn't grant the Fit scopes (or we got an auth error);
 * in that case the UI just hides health-aware features and the chat
 * prompt tells Gemini to skip the health rule.
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

export function buildHealthText(summary: HealthSummary | null): string {
  if (!summary) return "(no health data yet)";
  if (!summary.available) {
    return "(Google Fit not connected — health-aware scheduling disabled)";
  }

  const lines: string[] = [];
  if (typeof summary.sleepMinutes === "number" && summary.sleepMinutes > 0) {
    const h = Math.floor(summary.sleepMinutes / 60);
    const m = summary.sleepMinutes % 60;
    lines.push(
      `- Last night's sleep: ${h}h ${m}m (${summary.sleepQuality})`,
    );
  } else {
    lines.push("- Last night's sleep: (no data)");
  }

  if (typeof summary.steps === "number") {
    lines.push(`- Yesterday's steps: ${summary.steps.toLocaleString()}`);
  }
  if (typeof summary.activeMinutes === "number") {
    lines.push(`- Yesterday's active minutes: ${summary.activeMinutes}`);
  }

  return lines.join("\n");
}

/**
 * Short pill label for the chat panel's context pill.
 */
export function healthPillLabel(summary: HealthSummary | null): string | null {
  if (!summary || !summary.available) return null;
  if (typeof summary.sleepMinutes !== "number" || summary.sleepMinutes <= 0) {
    return null;
  }
  const h = Math.floor(summary.sleepMinutes / 60);
  const m = summary.sleepMinutes % 60;
  const q = summary.sleepQuality;
  return `slept ${h}h${m ? ` ${m}m` : ""} · ${q}`;
}
