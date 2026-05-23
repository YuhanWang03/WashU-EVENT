from fastapi import APIRouter

from app.data.loader import DATA
from app.schemas import User

router = APIRouter()


@router.get("/api/v1/users/self", response_model_exclude_none=True)
def get_self() -> User:
    return DATA.user
