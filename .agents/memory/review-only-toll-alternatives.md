---
name: Review-only toll alternatives
description: Safe behavior for routes whose active toll choices all still require operational review.
---

An active route may intentionally have no default toll alternative only while every active alternative is marked as requiring review. A quote for such a route must provide an explicit admin-selected alternative; otherwise pricing stops with a clear error.

**Why:** Some routes have several owner-supplied, numerically verified tariff options but unresolved operational direction or gate-pair meaning. Selecting one automatically would turn unconfirmed routing into a customer price.

**How to apply:** Keep every unconfirmed option active, non-default and review-marked so it is visible to admins but never selected automatically. Once any option is operationally approved, restore the normal invariant of exactly one active default or keep explicit selection mandatory through a deliberate model change.