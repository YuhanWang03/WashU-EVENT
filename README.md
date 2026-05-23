# Cadence

> **Status: in active development.** Cadence began as a 36-hour DEVFEST WashU
> hackathon app (Google Calendar + a DeepSeek chat assistant) and is being
> refactored into an **AI study-planning agent** that syncs with **Canvas LMS**,
> extracts tasks from syllabi/assignments, and generates adaptive study plans
> you can revise in natural language.

The repo is a monorepo with a TypeScript frontend, a Python backend, and an
in-repo mock of the Canvas API used for offline development.

## Architecture

```
frontend (Next.js 14)              backend (FastAPI, Python 3.12)
  calendar UI + chat panel   ──HTTP──>  API + scheduler (+ future agents)
  DeepSeek via /api/chat                       │
                                               ├── Postgres · Redis · Chroma
                                               └── Canvas API ──> mock_canvas
                                                   (real Canvas when available)
```

## Components

| Path | What it is | Stack | Status |
|---|---|---|---|
| `app/`, `components/`, `lib/` | Frontend: calendar week-view + AI chat | Next.js 14, React 18, TS, Tailwind | working |
| `backend/` | API + study-block scheduler (Python port) | FastAPI, uv, SQLAlchemy*, LangGraph* | scaffold + scheduler ([README](backend/README.md)) |
| `mock_canvas/` | Wire-compatible mock of the Canvas LMS API | FastAPI, uv | working ([README](mock_canvas/README.md)) |
| `docs/adr/` | Architecture decision records | — | [ADR-0001](docs/adr/0001-canvas-mock-server.md) |

<sub>* planned, not yet built.</sub>

## Quick start

### Full stack (Docker)

```bash
docker compose up --build
# postgres:5432 · redis:6379 · chroma:8001 · backend:8000 · mock_canvas:8080
```

### Frontend (dev)

```bash
npm install
npm run dev            # http://localhost:3000
```
Needs Google OAuth credentials + a DeepSeek API key (see Configuration).

### Backend (dev)

```bash
uv run --directory backend uvicorn app.main:app --port 8000
uv run --directory backend ruff check . && uv run --directory backend mypy . && uv run --directory backend pytest
```

### Mock Canvas (dev)

```bash
uv run --directory mock_canvas uvicorn app.main:app --port 8080
# see mock_canvas/README.md for endpoints, auth, and failure injection
```

## Configuration

Copy `.env.example` and fill in values. Frontend keys (read by Next.js from
`.env.local`): `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `DEEPSEEK_API_KEY`. Compose/Canvas keys (read by
`docker compose` from `.env`): `MOCK_CANVAS_TOKEN`, `CANVAS_BASE_URL`,
`CANVAS_ACCESS_TOKEN`.

---

## Frontend (the calendar app)

A Google Calendar–style web app with a **Cadence** AI chat panel on the right
(DeepSeek via an OpenAI-compatible API). Users sign in with Google, their
primary-calendar events render in a week view, and the chat panel has read-only
awareness of the events in view.

**Features**
- **Google OAuth sign in** via NextAuth.js (`calendar.readonly` scope).
- **Week view** mimicking Google Calendar: sticky header, mini-month sidebar,
  all-day row, hour grid, current-time indicator, overlap-safe columns.
- **Local scratch layer** — drag to move/resize, click to edit, click empty
  space to create. Stored in `localStorage` per user. **Google Calendar is
  never written to.**
- **Cadence chat panel** (`deepseek-chat`) that receives the week's events as
  context and can apply schedule changes via a structured action block.

**Setup**
1. Create an OAuth client ID (Web application) at
   <https://console.cloud.google.com/apis/credentials>; add redirect URI
   `http://localhost:3000/api/auth/callback/google` and the
   `https://www.googleapis.com/auth/calendar.readonly` scope.
2. Get a DeepSeek key at <https://platform.deepseek.com/api_keys>.
3. Copy `.env.example` → `.env.local`, fill in the frontend keys, `npm run dev`.

**Deploying the frontend** (Vercel): import the repo, set the frontend env vars,
set `NEXTAUTH_URL` to the production URL, and add the production
`/api/auth/callback/google` redirect URI in Google Cloud Console. (The backend
deploys separately via Docker, not Vercel.)

**Privacy**: the Calendar scope is read-only; events are fetched on demand and
passed to the chat endpoint as context, never persisted server-side. Revoke
access at <https://myaccount.google.com/permissions>.

## Roadmap

- [x] Frontend calendar + DeepSeek chat (migrated off Gemini/Google Fit)
- [x] Backend scaffold + greedy scheduler ported to Python (equivalence-tested)
- [x] Mock Canvas API for offline dev + deterministic eval ground truth
- [ ] Canvas client + sync (`backend/app/services`)
- [ ] Persistence (Postgres/SQLAlchemy), syllabus extraction (PyMuPDF)
- [ ] LangGraph agent orchestration + APScheduler periodic sync
- [ ] Evaluation harness

## Project layout

```
app/, components/, lib/   Next.js frontend (calendar + chat)
backend/                  FastAPI service: scheduler now; agents/DB/Canvas next
mock_canvas/              Wire-compatible Canvas API mock (offline dev + eval)
scripts/                  Dev tooling (e.g. scheduler equivalence fixtures)
docs/adr/                 Architecture decision records
docker-compose.yml        Postgres · Redis · Chroma · backend · mock_canvas
```
