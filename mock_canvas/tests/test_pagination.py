from fastapi.testclient import TestClient


def test_per_page_limits_items(
    client: TestClient, auth: dict[str, str]
) -> None:
    r = client.get("/api/v1/courses?per_page=2", headers=auth)
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_link_header_has_next_and_last(
    client: TestClient, auth: dict[str, str]
) -> None:
    link = client.get("/api/v1/courses?per_page=2", headers=auth).headers["Link"]
    assert 'rel="next"' in link
    assert 'rel="last"' in link
    assert "page=2" in link


def test_no_next_on_last_page(
    client: TestClient, auth: dict[str, str]
) -> None:
    # 5 courses / per_page=2 -> 3 pages; page 3 is the last.
    link = client.get(
        "/api/v1/courses?per_page=2&page=3", headers=auth
    ).headers["Link"]
    assert 'rel="next"' not in link
    assert 'rel="prev"' in link


def test_per_page_capped_at_100(
    client: TestClient, auth: dict[str, str]
) -> None:
    r = client.get("/api/v1/courses?per_page=999", headers=auth)
    assert len(r.json()) == 5
    assert "per_page=100" in r.headers["Link"]


def test_x_request_cost_header(
    client: TestClient, auth: dict[str, str]
) -> None:
    cost = client.get("/api/v1/courses", headers=auth).headers["X-Request-Cost"]
    assert 0.1 <= float(cost) <= 1.0
