---
name: Ferry single-price gate-pair compatibility
description: Compatibility and pricing rules for ferry toll points with one all-day price per vehicle class and ordered gate pair.
---

Ferry points use the shared closed-system gate-pair model with exactly one ALL price per vehicle class and ordered entry/exit pair. Ferry pricing never varies by clock time and DAY/NIGHT writes are rejected.

**Why:** The owner explicitly removed ferry day/night periods to keep tariff entry and price resolution simple. Existing legacy FLAT points still must not be converted when they contain tariffs because that could invalidate real pricing.

**How to apply:** Show only the compact gate-pair form for ferries. A tariff-free legacy FERRY+FLAT point may switch to GATE_PAIR atomically when its first compact tariff is saved; otherwise require explicit review. Ignore historical DAY/NIGHT rows in ferry quote resolution.