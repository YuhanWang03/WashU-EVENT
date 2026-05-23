from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.data.loader import DATA
from app.pagination import paginate
from app.schemas import Course

router = APIRouter()


@router.get("/api/v1/courses", response_model_exclude_none=True)
def list_courses(
    request: Request,
    response: Response,
    enrollment_state: str | None = None,
) -> list[Course]:
    courses = DATA.courses
    if enrollment_state == "active":
        courses = [c for c in courses if c.workflow_state == "available"]
    page_items, link = paginate(courses, request)
    response.headers["Link"] = link
    return page_items


@router.get("/api/v1/courses/{course_id}", response_model_exclude_none=True)
def get_course(
    course_id: int,
    include: Annotated[list[str] | None, Query(alias="include[]")] = None,
) -> Course:
    course = DATA.course(course_id)
    if course is None:
        raise HTTPException(
            status_code=404, detail="The specified resource does not exist."
        )
    if include and "syllabus_body" in include:
        return course.model_copy(
            update={"syllabus_body": DATA.syllabi.get(course.id)}
        )
    return course
