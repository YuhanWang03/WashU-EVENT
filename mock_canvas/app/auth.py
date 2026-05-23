"""Bearer-token auth matching a single configured token (Canvas-style)."""

import os

from fastapi import HTTPException
from starlette.requests import Request

_DEFAULT_TOKEN = "mock-token-dev"


def _expected_token() -> str:
    return os.environ.get("MOCK_CANVAS_TOKEN", _DEFAULT_TOKEN)


def verify_token(request: Request) -> None:
    """Reject the request unless it carries the configured Bearer token."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid access token.")
    token = header.removeprefix("Bearer ").strip()
    if token != _expected_token():
        raise HTTPException(status_code=401, detail="Invalid access token.")
