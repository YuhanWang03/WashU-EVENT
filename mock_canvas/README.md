# mock_canvas

A wire-compatible mock of the [Canvas LMS REST API](https://canvas.instructure.com/doc/api/)
for offline development of the Cadence Canvas integration.

## Why this exists

WashU restricts student API tokens at the institution level, and Canvas
Free-for-Teacher was disabled by Instructure following the May 2026
ShinyHunters security incident — so there is no live Canvas instance to build
against. This mock lets the backend's Canvas client be developed and tested
entirely offline, and it doubles as deterministic ground truth for the
evaluation harness. See [ADR-0001](../docs/adr/0001-canvas-mock-server.md).

The mock mirrors Canvas's paths and JSON shapes, so pointing
`CANVAS_BASE_URL` at it (instead of a real Canvas host) requires no client
code changes.

## Mocked endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/courses` | paginated; `?enrollment_state=active` |
| GET | `/api/v1/courses/:id` | `?include[]=syllabus_body` adds syllabus HTML |
| GET | `/api/v1/courses/:id/assignments` | paginated |
| GET | `/api/v1/courses/:id/quizzes` | paginated |
| GET | `/api/v1/courses/:id/modules` | paginated |
| GET | `/api/v1/users/self` | current user profile |

Cross-cutting behaviour: Bearer-token auth, `Link` pagination headers,
`X-Request-Cost` on every response, and `?simulate_error=` failure injection
(`429` / `500` / `timeout`). _(Endpoints land across commits MC3–MC5.)_

## Run locally

```bash
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8080
# or, from the repo root:
uv run --directory mock_canvas uvicorn app.main:app --port 8080
```

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `MOCK_CANVAS_TOKEN` | `mock-token-dev` | Bearer token the mock accepts |
| `MOCK_CANVAS_TIMEOUT_SECONDS` | `30` | sleep for `?simulate_error=timeout` |

## What this does NOT mock

- Write operations (POST/PUT/DELETE) — read-only GETs only.
- OAuth2 flows / token minting — a single static Bearer token.
- Submissions, grades, discussions, enrollments, announcements, calendar
  events, the GraphQL API.
- Real pagination cursors (uses simple page/per_page) and real rate limiting
  (`X-Request-Cost` is a cosmetic random value).
- Per-user authorization / multi-user data — one synthetic user, one dataset.
