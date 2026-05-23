"""Port of lib/scheduler.ts — the greedy study-block scheduler.

Kept semantically identical to the TypeScript engine so the two can be
verified for equivalence (see tests/test_scheduler_equivalence.py). Naming
is Pythonic (snake_case) and types use dataclasses.

Datetimes are naive local wall-clock, matching the browser-local TS engine.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from app.scheduling.models import (
    BlueTask,
    CalendarAction,
    CalendarEvent,
    SchedulerInput,
    SchedulerOutput,
)
from app.scheduling.task_category import get_task_category

# ── Constants ────────────────────────────────────────────────────────────────

DAY_START_HOUR = 6  # 06:00 — schedulable window start
DAY_END_HOUR = 24  # 00:00 (midnight) — schedulable window end

MAX_BLOCK_MIN = 90
MAX_BLOCK_NEAR_DEADLINE_MIN = 60

# Invisible break inserted after every non-red/green block.
BREAK_AFTER_MIN = 10
# Invisible buffer reserved before every red task.
RED_BUFFER_MIN = 15

_MIN_SLOT = timedelta(minutes=15)

_MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]  # fmt: skip


# ── Helpers ──────────────────────────────────────────────────────────────────


@dataclass
class _Interval:
    start: datetime
    end: datetime


def _is_local_id(event_id: str) -> bool:
    return event_id.startswith("local_")


def _day_bounds(target: datetime) -> tuple[datetime, datetime]:
    base = target.replace(hour=0, minute=0, second=0, microsecond=0)
    return base + timedelta(hours=DAY_START_HOUR), base + timedelta(hours=DAY_END_HOUR)


def _to_dt(iso: str | None) -> datetime | None:
    if not iso:
        return None
    try:
        return datetime.fromisoformat(iso)
    except ValueError:
        return None


def _same_day(a: datetime, b: datetime) -> bool:
    return a.date() == b.date()


def _merge_intervals(intervals: list[_Interval]) -> list[_Interval]:
    if not intervals:
        return []
    ordered = sorted(intervals, key=lambda iv: iv.start)
    merged = [_Interval(ordered[0].start, ordered[0].end)]
    for cur in ordered[1:]:
        last = merged[-1]
        if cur.start <= last.end:
            if cur.end > last.end:
                last.end = cur.end
        else:
            merged.append(_Interval(cur.start, cur.end))
    return merged


def _free_slots(
    occupied: list[_Interval],
    window_start: datetime,
    window_end: datetime,
) -> list[_Interval]:
    relevant = [
        iv for iv in occupied if iv.end > window_start and iv.start < window_end
    ]
    merged = _merge_intervals(relevant)

    free: list[_Interval] = []
    cursor = window_start
    for iv in merged:
        iv_start = window_start if iv.start < window_start else iv.start
        if iv_start > cursor:
            free.append(_Interval(cursor, iv_start))
        if iv.end > cursor:
            cursor = iv.end
    if cursor < window_end:
        free.append(_Interval(cursor, window_end))

    return [f for f in free if (f.end - f.start) >= _MIN_SLOT]


def _slot_minutes(slot: _Interval) -> float:
    return (slot.end - slot.start).total_seconds() / 60


def _to_hhmm(d: datetime) -> str:
    return f"{d.hour:02d}:{d.minute:02d}"


def _to_ymd(d: datetime) -> str:
    return f"{d.year:04d}-{d.month:02d}-{d.day:02d}"


# ── Deadline urgency + priority ──────────────────────────────────────────────


def _parse_deadline_date(deadline: str) -> date:
    return date.fromisoformat(deadline[:10])


def _deadline_urgency(deadline: str | None, target: datetime) -> int:
    if not deadline:
        return 1
    days_left = (_parse_deadline_date(deadline) - target.date()).days
    if days_left <= 0:
        return 5
    if days_left == 1:
        return 4
    if days_left <= 3:
        return 3
    if days_left <= 7:
        return 2
    return 1


def _task_priority(task: BlueTask, target: datetime) -> int:
    urgency = _deadline_urgency(task.deadline, target)
    type_bonus = 2 if task.type in ("exam_prep", "interview_prep") else 0
    return urgency * 2 + task.difficulty + type_bonus


# ── Block sizing ─────────────────────────────────────────────────────────────


def _max_block_for(task: BlueTask, target: datetime) -> int:
    urgency = _deadline_urgency(task.deadline, target)
    if urgency >= 4 and task.difficulty >= 3:
        return MAX_BLOCK_NEAR_DEADLINE_MIN
    return MAX_BLOCK_MIN


def _split_into_blocks(task: BlueTask, target: datetime) -> list[int]:
    max_block = _max_block_for(task, target)
    total = task.estimated_minutes
    if total <= max_block:
        return [total]

    blocks: list[int] = []
    remaining = total
    while remaining > 0:
        seg = min(remaining, max_block)
        # Absorb a tiny tail (< 15 min) into the previous block.
        if 0 < remaining - seg < 15 and blocks:
            blocks[-1] += remaining - seg
            break
        blocks.append(seg)
        remaining -= seg
    return blocks


def _preferred_window(difficulty: int) -> tuple[int, int]:
    """Return (earliest_hour, latest_start_hour); harder work goes earlier."""
    if difficulty >= 3:
        return (7, 12)
    if difficulty == 2:
        return (13, 17)
    return (14, 23)


# ── Main scheduling functions ────────────────────────────────────────────────


def schedule_day(data: SchedulerInput) -> SchedulerOutput:
    target = data.target_date
    day_start, day_end = _day_bounds(target)

    # Effective window start: now (if mid-day) or 06:00.
    window_start = (
        data.current_time
        if data.current_time is not None and data.current_time > day_start
        else day_start
    )

    actions: list[CalendarAction] = []
    notes: list[str] = []

    today_events: list[CalendarEvent] = []
    for ev in data.events:
        s = _to_dt(ev.start)
        if s is not None and _same_day(s, target):
            today_events.append(ev)

    # 1. Build occupied intervals (red + green + already-placed blue/local).
    occupied: list[_Interval] = []
    for ev in today_events:
        cat = get_task_category(ev.color_id)
        s = _to_dt(ev.start)
        e = _to_dt(ev.end)
        if s is None or e is None:
            continue

        if cat == "red":
            buffer_start = s - timedelta(minutes=RED_BUFFER_MIN)
            occupied.append(
                _Interval(day_start if buffer_start < day_start else buffer_start, e)
            )
        elif cat == "green":
            occupied.append(_Interval(s, e))
        elif cat == "blue" or _is_local_id(ev.id):
            # Already-placed blue / locally-created events block their slots.
            occupied.append(_Interval(s, e))

    # 2. Prioritise and place blue tasks.
    if not data.pending_tasks:
        return SchedulerOutput(actions=actions, notes=notes)

    ordered = sorted(
        data.pending_tasks, key=lambda t: _task_priority(t, target), reverse=True
    )

    for task in ordered:
        blocks = _split_into_blocks(task, target)
        earliest, latest = _preferred_window(task.difficulty)
        break_after = BREAK_AFTER_MIN

        for block_min in blocks:
            needed = block_min + break_after
            free = _free_slots(_merge_intervals(occupied), window_start, day_end)
            placed = False

            # First pass: prefer the difficulty-based window.
            for slot in free:
                slot_start = slot.start
                if slot_start.hour < earliest or slot_start.hour > latest:
                    continue
                if _slot_minutes(slot) >= needed:
                    block_end = slot_start + timedelta(minutes=block_min)
                    occupied_end = slot_start + timedelta(minutes=needed)
                    actions.append(
                        CalendarAction(
                            summary=task.summary,
                            day=_to_ymd(slot_start),
                            start=_to_hhmm(slot_start),
                            end=_to_hhmm(block_end),
                        )
                    )
                    occupied.append(_Interval(slot_start, occupied_end))
                    placed = True
                    break

            # Second pass: any free slot.
            if not placed:
                for slot in _free_slots(
                    _merge_intervals(occupied), window_start, day_end
                ):
                    if _slot_minutes(slot) >= needed:
                        block_end = slot.start + timedelta(minutes=block_min)
                        occupied_end = slot.start + timedelta(minutes=needed)
                        actions.append(
                            CalendarAction(
                                summary=task.summary,
                                day=_to_ymd(slot.start),
                                start=_to_hhmm(slot.start),
                                end=_to_hhmm(block_end),
                            )
                        )
                        occupied.append(_Interval(slot.start, occupied_end))
                        placed = True
                        break

            if not placed:
                notes.append(
                    f'⚠ Could not find a slot for "{task.summary}" '
                    f"({block_min} min) on {_MONTHS[target.month - 1]} {target.day}."
                )

    return SchedulerOutput(actions=actions, notes=notes)


def schedule_two_days(
    today: datetime,
    events: list[CalendarEvent],
    pending_tasks: list[BlueTask],
    current_time: datetime | None = None,
) -> SchedulerOutput:
    """Schedule today + tomorrow, rolling unplaced tasks over to tomorrow."""
    base = today.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = base + timedelta(days=1)

    today_result = schedule_day(
        SchedulerInput(
            target_date=today,
            events=events,
            pending_tasks=pending_tasks,
            current_time=current_time,
        )
    )

    placed_summaries = {a.summary for a in today_result.actions if a.type == "create"}
    rollover = [t for t in pending_tasks if t.summary not in placed_summaries]

    if not rollover:
        return today_result

    tomorrow_result = schedule_day(
        SchedulerInput(
            target_date=tomorrow,
            events=events,
            pending_tasks=rollover,
        )
    )

    names = ", ".join(t.summary for t in rollover)
    notes = [
        *today_result.notes,
        f"Rolled {len(rollover)} task(s) to tomorrow: {names}.",
        *tomorrow_result.notes,
    ]
    notes = [n for n in notes if n]

    return SchedulerOutput(
        actions=[*today_result.actions, *tomorrow_result.actions],
        notes=notes,
    )
