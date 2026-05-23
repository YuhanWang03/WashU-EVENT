import os

import pytest
from fastapi.testclient import TestClient

# Keep the timeout-injection test fast.
os.environ.setdefault("MOCK_CANVAS_TIMEOUT_SECONDS", "0")

from app.main import app  # noqa: E402


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def auth() -> dict[str, str]:
    return {"Authorization": "Bearer mock-token-dev"}
