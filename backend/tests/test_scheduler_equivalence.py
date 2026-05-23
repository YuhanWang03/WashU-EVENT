"""Equivalence tests: the Python scheduler must match the TypeScript engine.

Fixtures in fixtures/scheduler_cases.json are generated from lib/scheduler.ts
by scripts/gen_scheduler_fixtures.ts. Regenerate with:

    npx tsx scripts/gen_scheduler_fixtures.ts
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import pytest

from app.scheduling import (
    BlueTask,
    CalendarEvent,
    SchedulerInput,
    SchedulerOutput,
    schedule_day,
    schedule_two_days,
)

_FIXTURES = Path(__file__).parent / "fixtures" / "scheduler_cases.json"


def _load_cases() -> list[dict[str, Any]]:
    with _FIXTURES.open(encoding="utf-8") as f:
        cases: list[dict[str, Any]] = json.load(f)
    return cases


def _event(d: dict[str, Any]) -> CalendarEvent:
    return CalendarEvent(
        id=d["id"],
        start=d.get("start"),
        end=d.get("end"),
        summary=d.get("summary", ""),
        color_id=d.get("colorId"),
        all_day=d.get("allDay", False),
    )


def _task(d: dict[str, Any]) -> BlueTask:
    return BlueTask(
        id=d["id"],
        summary=d["summary"],
        type=d["type"],
        estimated_minutes=d["estimatedMinutes"],
        difficulty=d["difficulty"],
        deadline=d.get("deadline"),
        notes=d.get("notes"),
        placed=d.get("placed", False),
    )


def _dt(s: str | None) -> datetime | None:
    return datetime.fromisoformat(s) if s else None


def _run(case: dict[str, Any]) -> SchedulerOutput:
    inp = case["input"]
    events = [_event(e) for e in inp["events"]]
    tasks = [_task(t) for t in inp["pendingTasks"]]

    if case["kind"] == "day":
        target = _dt(inp["targetDate"])
        assert target is not None
        return schedule_day(
            SchedulerInput(
                target_date=target,
                events=events,
                pending_tasks=tasks,
                current_time=_dt(inp.get("currentTime")),
            )
        )

    today = _dt(inp["today"])
    assert today is not None
    return schedule_two_days(today, events, tasks, _dt(inp.get("currentTime")))


def _serialize(out: SchedulerOutput) -> dict[str, Any]:
    return {
        "actions": [
            {
                "type": a.type,
                "summary": a.summary,
                "day": a.day,
                "start": a.start,
                "end": a.end,
            }
            for a in out.actions
        ],
        "notes": list(out.notes),
    }


_CASES = _load_cases()


@pytest.mark.parametrize("case", _CASES, ids=[c["name"] for c in _CASES])
def test_python_matches_typescript(case: dict[str, Any]) -> None:
    assert _serialize(_run(case)) == case["expected"]
