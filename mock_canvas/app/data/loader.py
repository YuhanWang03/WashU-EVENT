"""Load the seed JSON + syllabus HTML into in-memory pydantic models.

Loaded once at import time and exposed as the module-level ``DATA`` object,
which the route handlers read from.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.schemas import Assignment, Course, Module, Quiz, User

_DATA_DIR = Path(__file__).parent
_SYLLABI_DIR = _DATA_DIR / "syllabi"


def _load_json(name: str) -> Any:
    with (_DATA_DIR / name).open(encoding="utf-8") as f:
        return json.load(f)


@dataclass(frozen=True)
class MockData:
    user: User
    courses: list[Course]
    syllabi: dict[int, str]
    assignments: dict[int, list[Assignment]]
    quizzes: dict[int, list[Quiz]]
    modules: dict[int, list[Module]]

    def course(self, course_id: int) -> Course | None:
        return next((c for c in self.courses if c.id == course_id), None)


def _load() -> MockData:
    raw_courses: list[dict[str, Any]] = _load_json("courses.json")
    courses: list[Course] = []
    syllabi: dict[int, str] = {}
    for rc in raw_courses:
        syllabus_file = rc.pop("syllabus_file")
        course = Course(**rc)
        courses.append(course)
        syllabi[course.id] = (_SYLLABI_DIR / syllabus_file).read_text(
            encoding="utf-8"
        )

    raw_assignments: list[dict[str, Any]] = _load_json("assignments.json")
    assignments: dict[int, list[Assignment]] = {}
    for ra in raw_assignments:
        assignment = Assignment(**ra)
        assignments.setdefault(assignment.course_id, []).append(assignment)

    raw_quizzes: dict[str, list[dict[str, Any]]] = _load_json("quizzes.json")
    quizzes = {
        int(cid): [Quiz(**q) for q in qs] for cid, qs in raw_quizzes.items()
    }

    raw_modules: dict[str, list[dict[str, Any]]] = _load_json("modules.json")
    modules = {
        int(cid): [Module(**m) for m in ms] for cid, ms in raw_modules.items()
    }

    user = User(
        id=1,
        name="Test Student",
        short_name="Test",
        sortable_name="Student, Test",
        login_id="tstudent",
        avatar_url="https://canvas.wustl.edu/images/messages/avatar-50.png",
        primary_email="tstudent@wustl.edu",
    )

    return MockData(
        user=user,
        courses=courses,
        syllabi=syllabi,
        assignments=assignments,
        quizzes=quizzes,
        modules=modules,
    )


DATA = _load()
