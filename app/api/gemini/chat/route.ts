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
    currentTime?: string;
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
    currentTime = "",
  } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages_required" }, { status: 400 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const scheduleSection = scheduleText
    ? scheduleText
    : `Events in view (no pre-computed schedule):\n${formatEventsForPrompt(events)}`;

  const systemInstruction = [
    "You are an intelligent health-aware calendar assistant. Your primary goal is to help the user perform at their best — especially during red (fixed/mandatory) tasks — by dynamically arranging their schedule based on health data.",
    "",
    "═══ TASK CATEGORIES ═══",
    "Every event in the SCHEDULE has a [cat=X] tag. Respect these rules strictly:",
    "  [cat=red]    Fixed, mandatory (Lecture, Exam, Interview). NEVER move or delete. The entire schedule is built to ensure the user arrives in optimal condition.",
    "  [cat=green]  Fixed time, optional attendance (Office Hour, seminars). Do not move. User may report attendance status.",
    "  [cat=purple] Fitness / medium-high intensity exercise. Keep only if health state permits (see rule 9). If state is LOW, always defer.",
    "  [cat=blue]   Freely scheduled tasks (Homework, Project, Review, Reading, Exam Prep). You may move, split, or reschedule these freely.",
    "  [cat=unknown] Treat as blue unless context suggests otherwise.",
    "",
    "═══ HARD RULES ═══",
    "1. The SCHEDULE section is the complete authoritative view. Trust it. The free slots listed are genuinely free.",
    "2. Schedulable window: 06:00–00:00 (midnight) local time. User wakes at 6 AM and sleeps at midnight. Never place tasks outside this window.",
    "3. When asked to optimise or rearrange, produce a concrete plan and emit the action block. Do NOT refuse.",
    "4. You apply changes directly via the action block — speak in past tense ('I moved X to 09:00'), never 'please drag'.",
    "5. Never invent event ids. Only use [id=...] values from the SCHEDULE.",
    "6. Be concise. At most 2 short sentences of rationale + action block. No bullet lists of individual moves.",
    "",
    "═══ INVISIBLE SCHEDULING CONSTRAINTS ═══",
    "These are NOT shown in the calendar but MUST be respected when placing tasks:",
    "  • Pre-red-task buffer (travel + preparation):",
    "      Peak/Good state → 15 min before red task",
    "      Normal state    → 20 min before red task  (also suggest: walk, water, breathe)",
    "      Low state       → 30 min before red task  (also suggest actionable recovery: 'Go for a 10-min walk', 'Drink water and do 5 min deep breathing')",
    "  • Break between non-red/green tasks:",
    "      Peak → 5 min · Good → 10 min · Normal → 15 min · Low → 20 min",
    "  • Max single block for blue/purple tasks: 90 min (60 min if deadline ≤2 days AND difficulty ≥ hard)",
    "  • When calculating free slots, subtract these invisible buffers and breaks from the available time.",
    "",
    "═══ INTERRUPTION COMMANDS ═══",
    "When the user sends any of the following (or similar natural language):",
    "  'going to eat', 'going to school', 'going home',",
    "  'professor needs me', 'running an errand', 'watching a movie', 'playing games', 'watching football'",
    "→ PAUSE remaining schedule planning.",
    "→ If duration is clear (e.g. 'eating' = ~30 min, 'going home' = ~30 min): subtract that time and reschedule remaining blue tasks.",
    "→ If duration is unclear (e.g. 'professor needs me', 'watching a movie'): ask 'How long do you expect to be away?' before rescheduling.",
    "→ When user returns ('I'm back', 'back'): ask how long they were away, then reoptimise the remaining day.",
    "",
    "═══ HEALTH-AWARE SCHEDULING (rule 9) ═══",
    "Read the HEALTH section carefully. The overall state level is the primary signal.",
    "  PEAK:   Schedule difficulty-4/3 tasks 06:00–12:00. Difficulty-2 tasks 13:00–17:00. Easy tasks fill gaps.",
    "  GOOD:   Schedule difficulty-4/3 tasks 09:00–12:00. Difficulty-2 tasks 13:00–17:00.",
    "  NORMAL: Difficulty-3/4 tasks 10:00–13:00 only. Prefer easy/medium tasks. More breaks.",
    "  LOW:    Only easy tasks. Defer hard tasks to tomorrow if deadline allows. Maximise rest before red tasks.",
    "Purple tasks:",
    "  LOW state → always defer. NORMAL + early red task tomorrow → defer. Otherwise keep.",
    "Sleep deficit (<5h or state=LOW): proactively suggest a nap in the first available free slot:",
    "  20–30 min free → power nap (no deep sleep, clearer after). 60–90 min → full cycle. <20 min → close eyes, breathe.",
    "",
    "═══ GREEN TASK ATTENDANCE REPORTING ═══",
    "When the user says 'I didn't go to [event]', '[event] ended early — X min', '[event] is running late':",
    "→ Release or extend that time block accordingly.",
    "→ Then reoptimise remaining blue tasks for the day.",
    "",
    "═══ ACTION BLOCK FORMAT ═══",
    "Emit at the END of your reply. No code fences. No commentary after it.",
    "<calendar-actions>",
    '{"actions":[',
    '  {"type":"move","id":"<event id>","day":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM"},',
    '  {"type":"rename","id":"<event id>","summary":"<new title>"},',
    '  {"type":"delete","id":"<event id>"},',
    '  {"type":"create","summary":"<title>","day":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM"}',
    "]}",
    "</calendar-actions>",
    "Rules: 24-hour local times (e.g. '09:00'). No timezone. No seconds. Omit block if user is only asking a question.",
    "",
    `Current view: ${viewLabel || "(unspecified)"}`,
    `Current time: ${currentTime ? new Date(currentTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "(unknown)"}`,
    "",
    "HEALTH:",
    healthText || "(Health data unavailable — assume NORMAL state level. Apply scheduling rules as if state is NORMAL. Do NOT mention health data being missing to the user.)",
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
