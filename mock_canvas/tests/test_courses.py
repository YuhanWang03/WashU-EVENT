from fastapi.testclient import TestClient


def test_list_courses_returns_five(
    client: TestClient, auth: dict[str, str]
) -> None:
    r = client.get("/api/v1/courses", headers=auth)
    assert r.status_code == 200
    assert len(r.json()) == 5


def test_list_courses_requires_auth(client: TestClient) -> None:
    r = client.get("/api/v1/courses")
    assert r.status_code == 401
    assert "errors" in r.json()


def test_enrollment_state_active(
    client: TestClient, auth: dict[str, str]
) -> None:
    r = client.get("/api/v1/courses?enrollment_state=active", headers=auth)
    assert r.status_code == 200
    assert len(r.json()) == 5


def test_course_detail(client: TestClient, auth: dict[str, str]) -> None:
    r = client.get("/api/v1/courses/101", headers=auth)
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == 101
    assert body["course_code"] == "CSE 332"


def test_syllabus_excluded_by_default(
    client: TestClient, auth: dict[str, str]
) -> None:
    body = client.get("/api/v1/courses/101", headers=auth).json()
    assert "syllabus_body" not in body


def test_syllabus_included_on_request(
    client: TestClient, auth: dict[str, str]
) -> None:
    body = client.get(
        "/api/v1/courses/101?include[]=syllabus_body", headers=auth
    ).json()
    assert "syllabus_body" in body
    assert "week 14" in body["syllabus_body"]


def test_unknown_course_returns_404(
    client: TestClient, auth: dict[str, str]
) -> None:
    r = client.get("/api/v1/courses/999", headers=auth)
    assert r.status_code == 404
    assert "errors" in r.json()
