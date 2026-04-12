import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/fit/detail
 *
 * Returns enhanced health metrics used to compute the user's StateLevel:
 *  - Sleep stages  (light / deep / REM minutes)
 *  - Resting heart rate  (min BPM recorded during the sleep window)
 *  - HRV  (RMSSD if the device syncs it; null otherwise)
 *
 * These supplement the basic /api/fit/summary data.  All fields can be
 * null when the device doesn't support them — callers must treat null
 * as "data unavailable" rather than a zero value.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken as string | undefined;

  if (!session || !accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  // Sleep window: 24 h ago → now.
  const sleepWindowStart = now - dayMs;
  const sleepWindowEnd = now;

  // ── Sleep stages ────────────────────────────────────────────────────────
  // activityType codes for sleep stages:
  //   109 = light sleep   110 = deep sleep   111 = REM   112 = awake
  let lightSleepMinutes: number | null = null;
  let deepSleepMinutes: number | null = null;
  let remSleepMinutes: number | null = null;

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

    const r = await fetch(sessionsUrl.toString(), {
      headers,
      cache: "no-store",
    });

    if (r.ok) {
      const data = await r.json();
      const sessions = Array.isArray(data.session) ? data.session : [];

      let lightMs = 0;
      let deepMs = 0;
      let remMs = 0;

      for (const s of sessions) {
        const type = Number(s.activityType ?? -1);
        const startMs = Number(s.startTimeMillis ?? 0);
        const endMs = Number(s.endTimeMillis ?? 0);
        const durationMs = endMs > startMs ? endMs - startMs : 0;

        if (type === 109) lightMs += durationMs;
        else if (type === 110) deepMs += durationMs;
        else if (type === 111) remMs += durationMs;
      }

      // Only set values if we got at least some stage data.
      if (lightMs + deepMs + remMs > 0) {
        lightSleepMinutes = Math.round(lightMs / 60000);
        deepSleepMinutes = Math.round(deepMs / 60000);
        remSleepMinutes = Math.round(remMs / 60000);
      }
    }
  } catch {
    // Ignore — values stay null.
  }

  // ── Resting heart rate ──────────────────────────────────────────────────
  // Query aggregated heart rate during the sleep window; the minimum BPM
  // in that period is a reasonable proxy for resting heart rate.
  let restingHeartRate: number | null = null;

  try {
    const aggUrl =
      "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate";
    const body = {
      aggregateBy: [{ dataTypeName: "com.google.heart_rate.bpm" }],
      bucketByTime: { durationMillis: dayMs },
      startTimeMillis: sleepWindowStart,
      endTimeMillis: sleepWindowEnd,
    };

    const r = await fetch(aggUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (r.ok) {
      const data = await r.json();
      const bucket = data.bucket?.[0];
      for (const ds of bucket?.dataset ?? []) {
        for (const point of ds.point ?? []) {
          // Aggregated HR points have min/max/avg in value[0/1/2].
          // index 0 = min (closest to resting HR).
          const minVal = point.value?.[0]?.fpVal;
          if (typeof minVal === "number" && minVal > 20) {
            if (restingHeartRate === null || minVal < restingHeartRate) {
              restingHeartRate = Math.round(minVal);
            }
          }
        }
      }
    }
  } catch {
    // Ignore — value stays null.
  }

  // ── HRV (RMSSD) ─────────────────────────────────────────────────────────
  // Not a standard Google Fit data type; some devices (Fitbit, Garmin) sync
  // it as a derived metric.  We try the most common data type name and fall
  // back to null if unavailable — this is expected for many devices.
  let hrv: number | null = null;

  try {
    const aggUrl =
      "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate";
    const body = {
      aggregateBy: [
        { dataTypeName: "com.google.heart_rate.variability.rmssd.summary" },
      ],
      bucketByTime: { durationMillis: dayMs },
      startTimeMillis: sleepWindowStart,
      endTimeMillis: sleepWindowEnd,
    };

    const r = await fetch(aggUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (r.ok) {
      const data = await r.json();
      const bucket = data.bucket?.[0];
      for (const ds of bucket?.dataset ?? []) {
        for (const point of ds.point ?? []) {
          const val = point.value?.[0]?.fpVal ?? point.value?.[0]?.intVal;
          if (typeof val === "number" && val > 0) {
            hrv = Math.round(val);
            break;
          }
        }
        if (hrv !== null) break;
      }
    }
  } catch {
    // Ignore — value stays null.
  }

  return NextResponse.json({
    lightSleepMinutes,
    deepSleepMinutes,
    remSleepMinutes,
    restingHeartRate,
    hrv,
  });
}
