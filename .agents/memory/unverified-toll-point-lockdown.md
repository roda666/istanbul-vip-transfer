---
name: Unverified toll point lockdown
description: Safety rule for toll points whose evidence is not sufficient for customer pricing.
---

When a toll point has unverified or contradictory fee evidence, use a durable verification lock rather than only marking it inactive. The lock must prevent point reactivation, tariff insertion or activation, vehicle classification assignment, alternative membership, and alternative reactivation at the database layer. The application must also filter such points from every quote resolver and reject direct API writes with an explanatory response.

**Why:** A UI-only inactive flag or one resolver check can be bypassed by a later import, sync, generic admin API call, or an explicitly supplied stale alternative ID. Keeping old tariffs and alternatives as inactive history permits audits without allowing them to affect a quote.

**How to apply:** Do not clear a verification lock through generic admin updates. A future reactivation needs a separately reviewed official-source verification flow or migration with explicit evidence and audit. Apply both the route-alternative and intercity-corridor paths whenever changing this safety rule.