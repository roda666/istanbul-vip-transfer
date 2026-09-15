---
name: Ferry day/night gate-pair compatibility
description: Compatibility and pricing rules for ferry toll points with time-banded gate-pair tariffs.
---

New ferry points use the shared closed-system gate-pair model and require explicit DAY/NIGHT cutovers in Europe/Istanbul time. Existing legacy ferry points with flat ALL tariffs remain editable and quotable without automatic conversion.

**Why:** Converting an existing flat ferry record without simultaneously supplying gate pairs, route assignments, and replacement tariffs would make valid production pricing disappear. Missing ferry cutovers must also stop period-specific pricing instead of guessing DAY.

**How to apply:** Keep create validation strict, but select legacy PATCH compatibility only after reading the stored point. Every GATE_PAIR listing and quote path must use the vehicle class assigned at that point, resolve the band through the shared Istanbul-time helper, and expose an explicit configuration warning when cutovers are missing or invalid.