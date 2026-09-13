---
name: Google review continuity
description: Public provenance and availability rules for Google Business Profile reviews during OAuth failures.
---

Previously synchronized reviews remain public when they are verified Google Business rows for the still-selected location, even if token refresh temporarily disables automatic synchronization. New sync work still requires a ready connection and must run through the shared expiring database lease.

**Why:** An OAuth repair issue must not turn verified historical customer reviews into fabricated fallback content or make the homepage unstable. Hiding all verified reviews on a refresh failure also creates an unnecessary public outage.

**How to apply:** Public readers require a connected profile, selected account/location, visible rows, and Google provenance; they do not require the sync-enabled flag. Never substitute manual or generated copy. Successful leased syncs invalidate every localized homepage only after provider and database work completes.