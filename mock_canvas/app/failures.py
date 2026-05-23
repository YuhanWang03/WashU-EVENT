"""Failure injection via ?simulate_error= to exercise client robustness.

- 429    -> 429 with a Retry-After header
- 500    -> 500
- timeout -> sleep MOCK_CANVAS_TIMEOUT_SECONDS, then succeed
"""

import asyncio
import os

from fastapi import HTTPException
from starlette.requests import Request

_DEFAULT_TIMEOUT_SECONDS = 30.0


def _timeout_seconds() -> float:
    try:
        return float(os.environ.get("MOCK_CANVAS_TIMEOUT_SECONDS", ""))
    except ValueError:
        return _DEFAULT_TIMEOUT_SECONDS


async def maybe_fail(request: Request) -> None:
    simulate = request.query_params.get("simulate_error")
    if simulate is None:
        return
    if simulate == "429":
        raise HTTPException(
            status_code=429,
            detail="Rate Limit Exceeded.",
            headers={"Retry-After": "30"},
        )
    if simulate == "500":
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred."
        )
    if simulate == "timeout":
        await asyncio.sleep(_timeout_seconds())
