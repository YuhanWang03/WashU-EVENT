from fastapi import APIRouter, HTTPException, Request, Response

from app.data.loader import DATA
from app.pagination import paginate
from app.schemas import Quiz

router = APIRouter()


@router.get(
    "/api/v1/courses/{course_id}/quizzes", response_model_exclude_none=True
)
def list_quizzes(
    course_id: int, request: Request, response: Response
) -> list[Quiz]:
    if DATA.course(course_id) is None:
        raise HTTPException(
            status_code=404, detail="The specified resource does not exist."
        )
    page_items, link = paginate(DATA.quizzes.get(course_id, []), request)
    response.headers["Link"] = link
    return page_items
