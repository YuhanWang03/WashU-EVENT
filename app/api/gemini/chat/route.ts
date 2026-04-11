import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "model"; content: string };
type CalendarEventLite = {
  summary?: string;
  start?: string | null;
  end?: string | null;
  location?: string;
  description?: string;
  allDay?: boolean;
};

function formatEventsForPrompt(events: CalendarEventLite[]): string {
  if (!events || events.length === 0) {
    return "(no events in the visible window)";
  }
  return events
    .slice(0, 80)
    .map((e, i) => {
      const start = e.start ?? "?";
      const end = e.end ?? "?";
      const loc = e.location ? ` @ ${e.location}` : "";
      const kind = e.allDay ? "[all-day] " : "";
      return `${i + 1}. ${kind}${e.summary ?? "(no title)"} — ${start} to ${end}${loc}`;
    })
    .join("\n");
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "missing_gemini_api_key" },
      { status: 500 },
    );
  }

  let body: {
    messages: ChatMessage[];
    events?: CalendarEventLite[];
    viewLabel?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { messages, events = [], viewLabel = "" } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages_required" }, { status: 400 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const systemInstruction = [
    "You are a helpful AI calendar assistant embedded in a Google Calendar style web app.",
    "You have read-only awareness of the user's events in the currently visible calendar view.",
    "Be concise, friendly, and action-oriented.",
    "When summarizing, group by day when helpful and surface conflicts or free slots.",
    "Never fabricate events that are not in the provided context.",
    "",
    `Current view: ${viewLabel || "(unspecified)"}`,
    "Events in view:",
    formatEventsForPrompt(events),
  ].join("\n");

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction,
  });

  // Build history: Gemini expects alternating user/model turns, with the last
  // user message sent separately via sendMessage().
  const historySource = messages.slice(0, -1);
  const lastMessage = messages[messages.length - 1];

  const history = historySource
    .filter((m) => m.role === "user" || m.role === "model")
    .map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));

  try {
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastMessage.content);
    const text = result.response.text();
    return NextResponse.json({ reply: text });
  } catch (err: any) {
    console.error("Gemini chat error", err);
    return NextResponse.json(
      { error: "gemini_failed", detail: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
