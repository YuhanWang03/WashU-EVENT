import random

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.routes import assignments, courses

app = FastAPI(title="Cadence Mock Canvas")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(courses.router)
app.include_router(assignments.router)


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
