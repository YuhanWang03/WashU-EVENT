"""Pydantic models mirroring the Canvas LMS API JSON shapes.

Only the fields the mock serves are modelled. Field names and types follow
the Canvas API docs (https://canvas.instructure.com/doc/api/) so that a
client cannot tell the mock apart from real Canvas for these endpoints.
"""

from pydantic import BaseModel


class User(BaseModel):
    id: int
    name: str
    short_name: str
    sortable_name: str
    login_id: str
    avatar_url: str
    primary_email: str
    locale: str = "en"


class Course(BaseModel):
    id: int
    name: str
    course_code: str
    workflow_state: str = "available"
    enrollment_term_id: int = 1
    start_at: str | None = None
    end_at: str | None = None
    # Populated only when include[]=syllabus_body is requested.
    syllabus_body: str | None = None


class Assignment(BaseModel):
    id: int
    course_id: int
    name: str
    description: str | None = None
    due_at: str | None = None
    points_possible: float
    submission_types: list[str]
    html_url: str
    published: bool = True
    grading_type: str = "points"


class Quiz(BaseModel):
    id: int
    title: str
    due_at: str | None = None
    points_possible: float
    quiz_type: str


class Module(BaseModel):
    id: int
    name: str
    position: int
    items_count: int
    workflow_state: str = "active"
    published: bool = True
