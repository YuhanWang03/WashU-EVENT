import random
from typing import cast

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.auth import verify_token
from app.failures import maybe_fail
from app.routes import assignments, courses, modules, quizzes, users

app = FastAPI(title="Cadence Mock Canvas")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def canvas_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Render HTTP errors in Canvas's `{"errors":[{"message":...}]}` shape."""
    http_exc = cast(StarletteHTTPException, exc)
    return JSONResponse(
        status_code=http_exc.status_code,
        content={"errors": [{"message": http_exc.detail}]},
        headers=http_exc.headers,
    )


app.add_exception_handler(StarletteHTTPException, canvas_error_handler)

# Auth runs before failure injection so a bad token is always 401.
_api_deps = [Depends(verify_token), Depends(maybe_fail)]

app.include_router(courses.router, dependencies=_api_deps)
app.include_router(assignments.router, dependencies=_api_deps)
app.include_router(quizzes.router, dependencies=_api_deps)
app.include_router(modules.router, dependencies=_api_deps)
app.include_router(users.router, dependencies=_api_deps)


@app.middleware("http")
async def add_request_cost(
    request: Request, call_next: RequestResponseEndpoint
) -> Response:
    """Simulate Canvas's X-Request-Cost rate-limit accounting header."""
    response = await call_next(request)
    response.headers["X-Request-Cost"] = f"{random.uniform(0.1, 1.0):.3f}"
    return response


@app.get("/")
def liveness() -> dict[str, str]:
    """Basic liveness probe (not part of the Canvas API surface)."""
    return {"service": "mock_canvas", "status": "ok"}
