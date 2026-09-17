---
name: EAFNOSUPPORT during admin acceptance tests means the web workflow is down
description: Playwright admin-acceptance fixture login fails with connect EAFNOSUPPORT ::1:<port> when the target Next.js dev workflow isn't actually running — not an app or test defect.
---

When every test in an admin-acceptance Playwright spec fails immediately in the
`adminContext` fixture with `apiRequestContext.post: connect EAFNOSUPPORT
::1:<port>` (or a plain connection-refused) on `POST /admin/api/login`, the
cause is that the artifact's web workflow has stopped or was never restarted
after a prior interruption — the fixture is trying to reach a server that
isn't listening.

**Why:** These fixtures hit the real dev server over HTTP before any page
navigation happens, so a stopped workflow surfaces as an immediate,
uniform failure across all tests in the run, easily mistaken for a
newly-introduced app or test-script bug.

**How to apply:** Before re-debugging test selectors/timing when an entire
suite fails identically at the login step, check the workflow status and
restart it (`WorkflowsRestart`) first, then re-run only the failing tests.
