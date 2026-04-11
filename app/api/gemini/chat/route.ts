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
    scheduleText?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const {
    messages,
    events = [],
    viewLabel = "",
    scheduleText = "",
  } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages_required" }, { status: 400 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const scheduleSection = scheduleText
    ? scheduleText
    : `Events in view (no pre-computed schedule):\n${formatEventsForPrompt(events)}`;

  const systemInstruction = [
    "You are a helpful AI calendar assistant embedded in a Google Calendar style web app.",
    "",
    "HARD RULES — read carefully:",
    "1. The SCHEDULE section below is the complete, authoritative view of the user's week. It already lists every event AND the computed free slots per day. Trust it.",
    "2. Any time that is NOT covered by an event is FREE and available to schedule. The user's schedulable window is 8:00 AM – 10:00 PM local time. Anything outside that is off-hours.",
    "3. When the user asks to rearrange, plan, or optimize, you MUST produce a concrete suggested schedule (specific times, specific days). Do NOT refuse or say you can't — you are allowed to propose any arrangement that fits the free slots.",
    "4. The user applies your suggestions by DRAGGING events in the UI (or by clicking an event to edit it). You cannot mutate the calendar directly, so always phrase changes as 'Move X from A to B' or 'Drag X to B'. Never claim to have made a change.",
    "5. Never invent events that are not in the SCHEDULE section. If asked about something that isn't there, say so.",
    "6. Be concise. Prefer bullet lists grouped by day. Use local 12-hour times (e.g. '3:00 PM').",
    "",
    `Current view: ${viewLabel || "(unspecified)"}`,
    "",
    "SCHEDULE:",
    scheduleSection,
  ].join("\n");

  // Model name is overridable via env so we can swap without a code change
  // if Google renames / deprecates models again.
  const modelName = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const model = genAI.getGenerativeModel({
    model: modelName,
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
