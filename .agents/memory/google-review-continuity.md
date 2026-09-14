---
name: Google review continuity
description: Public provenance and availability rules for Google Business Profile reviews during OAuth failures.
---

Previously synchronized reviews remain public when they are verified Google Business rows for the still-selected location, even if token refresh temporarily disables automatic synchronization. New sync work still requires a ready connection and must run through the shared expiring database lease.

Enabling My Business Account Management API does not necessarily grant usable access: Google may return `RATE_LIMIT_EXCEEDED` with the per-project request quota set to zero until Business Profile API quota access is approved. Treat this as an external access gate, not a token, scope, test-user, or retry problem.

**Why:** An OAuth repair issue must not turn verified historical customer reviews into fabricated fallback content or make the homepage unstable. Hiding all verified reviews on a refresh failure also creates an unnecessary public outage. A successful OAuth callback and `business.manage` scope can coexist with a zero provider quota.

**How to apply:** Public readers require a connected profile, selected account/location, visible rows, and Google provenance; they do not require the sync-enabled flag. Never substitute manual or generated copy. Successful leased syncs invalidate every localized homepage only after provider and database work completes. When account listing returns a zero quota, surface the provider gate and request/confirm Google quota access before retrying.