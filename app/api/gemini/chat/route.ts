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
    healthText?: string;
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
    healthText = "",
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
    "3. When the user asks to rearrange, plan, or optimize, you MUST produce a concrete plan that fits the free slots and then apply it via the action block in rule 7. Do NOT refuse.",
    "4. You CAN mutate the calendar directly via the action block (rule 7). After emitting it, the app moves the events for the user — they do NOT drag anything. Speak in past tense ('I moved X to the morning'), never 'please drag' or 'you should move'.",
    "5. Never invent events that are not in the SCHEDULE section. If asked about something that isn't there, say so.",
    "6. Be extremely concise. Your visible reply is at MOST 2 short sentences of rationale followed by the action block. NEVER enumerate individual moves in prose — the action block already does that and repeating it is noise. NEVER put event ids, `[id=...]` markers, or JSON in the visible prose; those belong ONLY inside the <calendar-actions> block. Do not use bullet lists of moves.",
    "7. ACTIONS — when the user asks you to move, rearrange, rename, delete, or create events, you MUST actually perform the change yourself by emitting an action block at the very END of your reply. The app reads the block and applies the changes automatically. Format the block exactly as specified below.",
    "8. DIFFICULTY + HEALTH-AWARE SCHEDULING — when the user asks you to 'optimize', 'rearrange by difficulty', or 'plan based on my sleep/health', do the following:",
    "   a. For each event in the SCHEDULE, silently classify its cognitive difficulty as HARD, MEDIUM, or EASY based on the title/description. Examples: 'advanced algorithm homework', 'research paper', 'study for exam', 'deep work', 'technical interview' → HARD. 'gym', 'lunch', 'laundry', 'coffee chat', 'commute', 'errands' → EASY. Meetings, reviews, emails → MEDIUM.",
    "   b. Read the HEALTH section. If `sleepQuality` is `good` (≥7h): schedule HARD tasks in the morning block (8:00–12:00) of TODAY. If `ok` (6–7h): keep HARD tasks but prefer 9:30–11:30. If `poor` (<6h): DEFER HARD tasks to the next day, PROVIDED this does not push the task past any mentioned deadline. If deferring would miss a deadline, keep it today in 10:00–12:00 and put EASY tasks in the afternoon.",
    "   c. EASY tasks fill the afternoon (12:00–17:00). MEDIUM tasks fill the remaining gaps, preferring 13:00–16:00.",
    "   d. Say ONE short sentence of rationale (≤15 words) that references the sleep status if present — e.g. 'Put harder work first since your morning is clear.' or 'You slept 5h 40m, so I deferred the algorithms homework to tomorrow morning.' Then emit the <calendar-actions> block. NO bullet list. NO per-move narration.",
    "   e. If the HEALTH section says Google Fit is not connected, SKIP the sleep-based deferral and just rearrange by difficulty (hard-in-morning / easy-in-afternoon). Mention 'Connect Google Fit for sleep-aware scheduling.' ONCE at the end, after the action block.",
    "",
    "   The action block format is EXACTLY (no code fences, no extra commentary after it):",
    "   <calendar-actions>",
    '   {"actions":[',
    '     {"type":"move","id":"<event id>","day":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM"},',
    '     {"type":"rename","id":"<event id>","summary":"<new title>"},',
    '     {"type":"delete","id":"<event id>"},',
    '     {"type":"create","summary":"<title>","day":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM"}',
    "   ]}",
    "   </calendar-actions>",
    "",
    "   Rules for actions:",
    "   - Use 24-hour times in local time, e.g. '09:00', '14:30'. NEVER include a timezone or seconds.",
    "   - The `id` MUST match one of the `[id=...]` markers in the SCHEDULE section below. Never invent ids.",
    "   - `day` is YYYY-MM-DD in local time.",
    "   - Include only the action types actually needed. Omit the block entirely if the user is only asking a question.",
    "   - Only emit actions that keep the event inside the 8:00–22:00 window and do not overlap another event (unless the user explicitly asks for an overlap).",
    "   - Do NOT wrap the JSON in markdown code fences.",
    "",
    `Current view: ${viewLabel || "(unspecified)"}`,
    "",
    "HEALTH (Google Fit):",
    healthText || "(no health data)",
    "",
    "SCHEDULE:",
    scheduleSection,
  ].join("\n");

  // Model names are overridable via env so we can swap without a code
  // change if Google renames / deprecates models again.
  const primaryModel = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const fallbackModel =
    process.env.GEMINI_FALLBACK_MODEL ?? "gemini-2.0-flash";

  // Build history: Gemini expects alternating user/model turns, with the
  // last user message sent separately via sendMessage().
  const historySource = messages.slice(0, -1);
  const lastMessage = messages[messages.length - 1];

  const history = historySource
    .filter((m) => m.role === "user" || m.role === "model")
    .map((m) => ({ role: m.role, parts: [{ text: m.content }] }));

  async function callOnce(modelName: string): Promise<string> {
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction,
    });
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastMessage.content);
    return result.response.text();
  }

  // Retry transient errors (overload / rate limit / 5xx) with exponential
  // backoff. If the primary is still unhappy after retries, try the
  // fallback model once so the user still gets a response.
  const TRANSIENT_PATTERNS = [
    /\b503\b/,
    /\b502\b/,
    /\b500\b/,
    /\b429\b/,
    /overloaded/i,
    /unavailable/i,
    /quota/i,
    /rate limit/i,
    /high demand/i,
  ];
  const isTransient = (msg: string) =>
    TRANSIENT_PATTERNS.some((re) => re.test(msg));

  const backoffsMs = [400, 1200, 3000];
  let lastError: any = null;

  for (let attempt = 0; attempt <= backoffsMs.length; attempt++) {
    try {
      const text = await callOnce(primaryModel);
      return NextResponse.json({ reply: text });
    } catch (err: any) {
      lastError = err;
      const msg = err?.message ?? String(err);
      if (!isTransient(msg) || attempt === backoffsMs.length) break;
      await new Promise((r) => setTimeout(r, backoffsMs[attempt]));
    }
  }

  // Primary exhausted — try the fallback model once.
  try {
    const text = await callOnce(fallbackModel);
    return NextResponse.json({ reply: text, usedFallback: fallbackModel });
  } catch (err: any) {
    lastError = err;
  }

  const detail = lastError?.message ?? String(lastError);
  const transient = isTransient(detail);
  console.error("Gemini chat error", lastError);
  return NextResponse.json(
    {
      error: transient ? "gemini_overloaded" : "gemini_failed",
      detail: transient
        ? "Google's Gemini service is temporarily overloaded. Please try again in a few seconds."
        : detail,
    },
    { status: transient ? 503 : 500 },
  );
}
