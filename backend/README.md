# Cadence backend

FastAPI service (uv, Python 3.12) for the Cadence study-planning agent. This is
the tier that will host the Canvas integration, persistence, and the agent
orchestration; today it contains the API skeleton and the scheduling engine.

## What's here now

- `app/main.py` — FastAPI app with a `/health` endpoint.
- `app/config.py` — `pydantic-settings` config (datastore + DeepSeek env vars).
- `app/scheduling/` — the greedy study-block scheduler ported from the
  frontend's `lib/scheduler.ts`, kept **semantically identical** and verified by
  golden-fixture equivalence tests:
  - `models.py` — dataclasses (`BlueTask`, `CalendarEvent`, `CalendarAction`, …)
  - `task_category.py` — Google colorId → category mapping
  - `scheduler.py` — `schedule_day` / `schedule_two_days`
- `tests/` — `/health` smoke test + scheduler equivalence tests.

## Run

```bash
uv sync
uv run uvicorn app.main:app --port 8000     # http://localhost:8000/health
```

## Checks

```bash
uv run ruff check .
uv run mypy .
uv run pytest
```

The scheduler equivalence fixtures are generated from the TypeScript engine:

```bash
# from the repo root
npx tsx scripts/gen_scheduler_fixtures.ts
```

## Planned (not yet built)

Canvas client (`app/services/`), SQLAlchemy 2.0 async models + migrations,
syllabus/assignment extraction, a LangGraph agent graph, and APScheduler-driven
periodic Canvas sync.
