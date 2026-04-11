import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/fit/summary
 *
 * Returns a lightweight daily health summary from Google Fit: last night's
 * sleep minutes and yesterday's step count + active minutes. Gemini uses
 * this to decide whether to schedule hard work in the morning (well-rested)
 * or defer it (poorly rested).
 *
 * If the user has not granted the Fit scopes, we return a structured
 * `unavailable` payload rather than 403ing — the frontend treats missing
 * health data as "just skip the health-aware rule" and Gemini is told so
 * in its system prompt.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken as string | undefined;

  if (!session || !accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Build "last completed night" window: previous day 8 PM -> today 11 AM
  // in the server's UTC clock. This is a rough heuristic; we expect the
  // client's locale to be close enough for directional guidance.
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const sleepWindowStart = now - dayMs; // 24h ago
  const sleepWindowEnd = now;

  // Yesterday 00:00 UTC -> now, for activity.
  const yesterdayStart = new Date();
  yesterdayStart.setUTCHours(0, 0, 0, 0);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  // ---- Sleep ----
  // We use the sessions endpoint (sleep is stored as sessions with
  // activityType=72 — "sleeping"), which is more reliable than aggregating
  // com.google.sleep.segment.
  let sleepMinutes: number | null = null;
  let sleepScope = "ok" as "ok" | "missing" | "error";
  try {
    const sessionsUrl = new URL(
      "https://www.googleapis.com/fitness/v1/users/me/sessions",
    );
    sessionsUrl.searchParams.set(
      "startTime",
      new Date(sleepWindowStart).toISOString(),
    );
    sessionsUrl.searchParams.set(
      "endTime",
      new Date(sleepWindowEnd).toISOString(),
    );
    sessionsUrl.searchParams.set("activityType", "72");

    const r = await fetch(sessionsUrl.toString(), {
      headers,
      cache: "no-store",
    });
    if (r.status === 401 || r.status === 403) {
      sleepScope = "missing";
    } else if (!r.ok) {
      sleepScope = "error";
    } else {
      const data = await r.json();
      const sessions = Array.isArray(data.session) ? data.session : [];
      let totalMs = 0;
      for (const s of sessions) {
        const startMs = Number(s.startTimeMillis ?? 0);
        const endMs = Number(s.endTimeMillis ?? 0);
        if (endMs > startMs) totalMs += endMs - startMs;
      }
      sleepMinutes = Math.round(totalMs / 60000);
    }
  } catch {
    sleepScope = "error";
  }

  // ---- Activity (step count + active minutes, yesterday) ----
  let steps: number | null = null;
  let activeMinutes: number | null = null;
  let activityScope = "ok" as "ok" | "missing" | "error";
  try {
    const aggUrl =
      "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate";
    const body = {
      aggregateBy: [
        { dataTypeName: "com.google.step_count.delta" },
        { dataTypeName: "com.google.active_minutes" },
      ],
      bucketByTime: { durationMillis: dayMs },
      startTimeMillis: yesterdayStart.getTime(),
      endTimeMillis: yesterdayStart.getTime() + dayMs,
    };
    const r = await fetch(aggUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (r.status === 401 || r.status === 403) {
      activityScope = "missing";
    } else if (!r.ok) {
      activityScope = "error";
    } else {
      const data = await r.json();
      const bucket = data.bucket?.[0];
      const datasets = bucket?.dataset ?? [];
      for (const ds of datasets) {
        for (const p of ds.point ?? []) {
          const v = p.value?.[0];
          if (!v) continue;
          if (ds.dataSourceId?.includes("step_count")) {
            steps = (steps ?? 0) + Number(v.intVal ?? 0);
          } else if (ds.dataSourceId?.includes("active_minutes")) {
            activeMinutes = (activeMinutes ?? 0) + Number(v.intVal ?? 0);
          }
        }
      }
      // Fallback: sometimes Fit returns an empty bucket for a brand-new
      // account. Keep the numbers as null rather than 0 so Gemini knows
      // the data is simply missing.
      if (datasets.length === 0) {
        steps = null;
        activeMinutes = null;
      }
    }
  } catch {
    activityScope = "error";
  }

  const unavailable =
    sleepScope === "missing" && activityScope === "missing";
  if (unavailable) {
    return NextResponse.json({
      available: false,
      reason: "fit_scope_missing",
    });
  }

  // Rough qualitative label for the model.
  let sleepQuality: "good" | "ok" | "poor" | "unknown" = "unknown";
  if (typeof sleepMinutes === "number") {
    if (sleepMinutes >= 7 * 60) sleepQuality = "good";
    else if (sleepMinutes >= 6 * 60) sleepQuality = "ok";
    else if (sleepMinutes > 0) sleepQuality = "poor";
  }

  return NextResponse.json({
    available: true,
    sleepMinutes,
    sleepQuality,
    steps,
    activeMinutes,
    scopes: { sleep: sleepScope, activity: activityScope },
  });
}
