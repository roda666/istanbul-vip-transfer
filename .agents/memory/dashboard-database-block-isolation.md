---
name: Dashboard database block isolation
description: Resilience rules for admin dashboard data loading and migration errors.
---

Admin dashboard sections must load independently. A failure in a noncritical query must preserve the other dashboard sections and show a scoped, actionable warning instead of a global database-connection error.

**Why:** A missing `reservation_submission_failures` relation caused an unrelated query to reject a shared `Promise.all`, which hid working audit and request data behind a misleading connection error.

**How to apply:** Wrap each visual dashboard block in a typed fallback result. Map PostgreSQL missing-relation (`42P01`) and missing-column (`42703`) errors to migration-specific messages; do not label them as `DATABASE_URL` or generic connection failures.