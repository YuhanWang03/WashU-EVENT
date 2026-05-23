# ADR-0001: Build an in-repo Canvas mock server

- **Status:** Accepted
- **Date:** 2026-05-23
- **Deciders:** Project owner

## Context

The agent's primary data source is Canvas LMS. To develop and test the Canvas
integration we need a Canvas API to call. Two obvious routes to a real API are
both unavailable:

1. **WashU Canvas personal access tokens** are disabled at the institution
   level by the WashU Canvas administrators, so a student cannot mint a token
   to call the WashU Canvas API.
2. **Canvas Free-for-Teacher** (`canvas.instructure.com`), the usual way indie
   developers get a free, self-managed Canvas instance with API access, was
   disabled by Instructure following the **May 2026 ShinyHunters security
   incident**.

Without a reachable Canvas API, the Canvas client, the sync service, and the
syllabus/assignment extraction work cannot be developed or tested, and there is
no stable ground truth for the evaluation harness.

## Decision

Build a small, in-repo **mock Canvas API server** (`mock_canvas/`, FastAPI) that
is **wire-compatible** with the subset of the Canvas REST API the project uses:
courses, course detail (incl. `syllabus_body`), assignments, quizzes, modules,
and `users/self`. It mirrors Canvas's URL paths, JSON shapes, Bearer-token auth,
`Link`-header pagination, and rate-limit/error behaviour, and adds deliberate
failure injection (`?simulate_error=429|500|timeout`).

Because it is wire-compatible, pointing `CANVAS_BASE_URL` at the mock versus a
real Canvas host requires **zero changes** to the backend's Canvas client. The
mock ships deterministic seed data (5 synthetic WashU courses) so it also serves
as **ground truth** for evaluation — including a deliberately tricky
prose-only deadline in the CSE 332 syllabus for the future Extraction Agent.

## Alternatives considered

- **Wait for real Canvas access.** Rejected: both avenues are blocked with no
  known timeline; this would halt the project.
- **Record/replay real Canvas traffic (VCR-style fixtures).** Rejected: we have
  no real instance to record from in the first place, and replay can't simulate
  pagination edges or failure modes on demand.
- **Mock only at the client layer (monkeypatch httpx in tests).** Rejected: that
  tests the client against our assumptions, not against an HTTP server, and
  gives nothing to run the full stack against in docker-compose or to demo.
- **Use a third-party Canvas sandbox/Docker image.** Rejected: heavyweight,
  and the official Canvas app is far more than we need; our mock is a few
  hundred lines and tailored to the endpoints we consume.

## Consequences

**Positive**
- Fully offline development and CI; no secrets or external dependencies.
- Deterministic, controllable data and failure modes → reliable tests and a
  stable evaluation baseline.
- A real HTTP service to run in docker-compose alongside the backend, and to
  demo end-to-end.
- Swapping to real Canvas later is a config change (`CANVAS_BASE_URL` +
  `CANVAS_ACCESS_TOKEN`), not a code change.

**Negative / risks**
- The mock encodes *our understanding* of Canvas; real Canvas may differ in
  fields or edge cases we haven't modelled. Mitigation: keep shapes faithful to
  the Canvas API docs and re-verify against a real instance if one becomes
  available.
- It only mocks read endpoints and a single user/dataset (see
  `mock_canvas/README.md` "What this does NOT mock").
- Seed dates are anchored to a fixed semester (Mon 2026-05-25); they are stable
  ground truth but will read as "in the past" once that date passes.
