"""Dataclasses mirroring the TypeScript scheduler types.

Pythonic snake_case equivalents of the types in lib/scheduler.ts,
lib/types.ts (CalendarEvent) and lib/actions.ts (CalendarAction).

Datetime convention: all `datetime` values are naive and represent local
wall-clock time, matching the browser-local semantics of the TS engine.
Event/deadline strings are local ISO-8601 (no timezone suffix).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class CalendarEvent:
    """Subset of the TS CalendarEvent used by the scheduler."""

    id: str
    start: str | None
    end: str | None
    summary: str = ""
    color_id: str | None = None
    all_day: bool = False


@dataclass
class BlueTask:
    """A user-defined task that needs time allocated (TS BlueTask)."""

    id: str
    summary: str
    type: str
    estimated_minutes: int
    difficulty: int  # 1=easy … 4=very hard
    deadline: str | None = None  # local "YYYY-MM-DD" or None
    notes: str | None = None
    placed: bool = False


@dataclass
class CalendarAction:
    """A scheduler-emitted action. The engine only ever emits 'create'."""

    summary: str
    day: str
    start: str
    end: str
    type: str = "create"


@dataclass
class SchedulerInput:
    target_date: datetime
    events: list[CalendarEvent] = field(default_factory=list)
    pending_tasks: list[BlueTask] = field(default_factory=list)
    current_time: datetime | None = None


@dataclass
class SchedulerOutput:
    actions: list[CalendarAction] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
