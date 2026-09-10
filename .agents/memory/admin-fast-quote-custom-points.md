---
name: Admin fast-quote custom points
description: Safety boundary between custom coordinates, catalog locations, and protected toll-route selection.
---

Open-address and map-pin inputs may be used directly for admin-only distance pricing. They must not create or guess a toll scenario by themselves. Toll alternatives become eligible only when each endpoint safely matches a nearby active catalog location and that ordered pair exactly matches an active stored route. Review-only routes still require an explicit alternative selection.

**Why:** A free-form address or approximate map point can be close to several dense-city locations. Treating it as a route endpoint without a strict catalog boundary could silently apply the wrong real tariff.

**How to apply:** Preserve coordinate-first distance calculation, a narrow proximity threshold for catalog matching, exact directed route matching, and the existing review/default rules. Keep every coordinate and toll detail inside protected admin APIs and UI.