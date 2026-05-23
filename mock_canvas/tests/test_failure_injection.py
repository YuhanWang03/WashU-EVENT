from fastapi.testclient import TestClient


def test_simulate_429(client: TestClient, auth: dict[str, str]) -> None:
    r = client.get("/api/v1/courses?simulate_error=429", headers=auth)
    assert r.status_code == 429
    assert r.headers["Retry-After"] == "30"
    assert "errors" in r.json()


def test_simulate_500(client: TestClient, auth: dict[str, str]) -> None:
    r = client.get("/api/v1/courses?simulate_error=500", headers=auth)
    assert r.status_code == 500
    assert "errors" in r.json()


def test_simulate_timeout_succeeds(
    client: TestClient, auth: dict[str, str]
) -> None:
    # conftest sets MOCK_CANVAS_TIMEOUT_SECONDS=0 so this returns promptly.
    r = client.get("/api/v1/courses?simulate_error=timeout", headers=auth)
    assert r.status_code == 200
    assert len(r.json()) == 5


def test_wrong_token_401(client: TestClient) -> None:
    r = client.get(
        "/api/v1/courses", headers={"Authorization": "Bearer wrong"}
    )
    assert r.status_code == 401


def test_auth_precedes_failure_injection(client: TestClient) -> None:
    # Bad token + simulate_error should still be 401, not 429.
    r = client.get(
        "/api/v1/courses?simulate_error=429",
        headers={"Authorization": "Bearer wrong"},
    )
    assert r.status_code == 401
