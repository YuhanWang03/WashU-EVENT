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
    "3. When the user asks to rearrange, plan, or optimize, you MUST produce a concrete suggested schedule (specific times, specific days). Do NOT refuse or say you can't — you are allowed to propose any arrangement that fits the free slots.",
    "4. The user applies your suggestions by DRAGGING events in the UI (or by clicking an event to edit it). You cannot mutate the calendar directly, so always phrase changes as 'Move X from A to B' or 'Drag X to B'. Never claim to have made a change.",
    "5. Never invent events that are not in the SCHEDULE section. If asked about something that isn't there, say so.",
    "6. Be concise. Prefer bullet lists grouped by day. Use local 12-hour times (e.g. '3:00 PM') in your prose.",
    "7. ACTIONS — when the user asks you to move, rearrange, rename, delete, or create events, you MUST actually perform the change yourself by emitting an action block at the very END of your reply. The app will read the block and apply the changes to the calendar automatically; the user does NOT drag anything. Phrase the prose as 'Done — I moved X to Y' (past tense), NOT 'you should drag'.",
    "8. DIFFICULTY + HEALTH-AWARE SCHEDULING — when the user asks you to 'optimize', 'rearrange by difficulty', or 'plan based on my sleep/health', do the following:",
    "   a. For each event in the SCHEDULE, silently classify its cognitive difficulty as HARD, MEDIUM, or EASY based on the title/description. Examples: 'advanced algorithm homework', 'research paper', 'study for exam', 'deep work', 'technical interview' → HARD. 'gym', 'lunch', 'laundry', 'coffee chat', 'commute', 'errands' → EASY. Meetings, reviews, emails → MEDIUM.",
    "   b. Read the HEALTH section. If `sleepQuality` is `good` (≥7h) the user is well-rested: schedule HARD tasks in the morning block (8:00–12:00) of TODAY. If `ok` (6–7h): keep HARD tasks but prefer 9:30–11:30. If `poor` (<6h): DEFER HARD tasks to the next day that has a well-rested expectation (or at least ≥24h recovery), PROVIDED this does not push the task past any mentioned deadline in its description. If deferring would miss a deadline, keep it today but move it to a late-morning slot (10:00–12:00) and put EASY tasks in the afternoon to save energy.",
    "   c. EASY tasks fill the afternoon (12:00–17:00). MEDIUM tasks fill the remaining gaps, preferring 13:00–16:00.",
    "   d. Explain your reasoning in 1–3 short bullets referencing the sleep number (e.g. 'You slept 5h 40m — poor, so I moved the algorithm homework to tomorrow morning'). Then emit the `<calendar-actions>` block with the concrete moves. Do NOT list suggestions without an action block.",
    "   e. If the HEALTH section says Google Fit is not connected, SKIP the sleep-based deferral and just rearrange by difficulty with hard-in-morning / easy-in-afternoon, and tell the user once that connecting Google Fit will enable sleep-aware scheduling.",
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
