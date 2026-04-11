import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/calendar/events?timeMin=...&timeMax=...
// Returns the authenticated user's primary-calendar events in the window.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken as string | undefined;

  if (!session || !accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const timeMin = searchParams.get("timeMin") ?? new Date().toISOString();
  const timeMax =
    searchParams.get("timeMax") ??
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const url = new URL(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
  );
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: "calendar_fetch_failed", detail: text },
      { status: res.status },
    );
  }

  const data = await res.json();
  const events = (data.items ?? []).map((item: any) => ({
    id: item.id,
    summary: item.summary ?? "(no title)",
    description: item.description ?? "",
    location: item.location ?? "",
    start: item.start?.dateTime ?? item.start?.date ?? null,
    end: item.end?.dateTime ?? item.end?.date ?? null,
    allDay: Boolean(item.start?.date && !item.start?.dateTime),
    htmlLink: item.htmlLink ?? null,
    colorId: item.colorId ?? null,
  }));

  return NextResponse.json({ events });
}
