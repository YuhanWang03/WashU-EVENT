from fastapi.testclient import TestClient


def test_list_assignments(client: TestClient, auth: dict[str, str]) -> None:
    r = client.get("/api/v1/courses/101/assignments", headers=auth)
    assert r.status_code == 200
    assert len(r.json()) == 8


def test_assignment_has_expected_fields(
    client: TestClient, auth: dict[str, str]
) -> None:
    a = client.get("/api/v1/courses/101/assignments", headers=auth).json()[0]
    for field in (
        "id",
        "name",
        "due_at",
        "points_possible",
        "html_url",
        "submission_types",
        "course_id",
    ):
        assert field in a
    assert a["course_id"] == 101
    assert isinstance(a["submission_types"], list)


def test_assignments_unknown_course_404(
    client: TestClient, auth: dict[str, str]
) -> None:
    r = client.get("/api/v1/courses/999/assignments", headers=auth)
    assert r.status_code == 404


def test_assignments_require_auth(client: TestClient) -> None:
    assert client.get("/api/v1/courses/101/assignments").status_code == 401
