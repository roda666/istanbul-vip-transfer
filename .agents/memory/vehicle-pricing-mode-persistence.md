---
name: Vehicle pricing mode persistence
description: Product rule for retaining distance and hourly formulas while selecting one active vehicle pricing mode.
---

Each vehicle keeps the latest saved distance formula and hourly formula independently. Saving one mode makes it the vehicle’s only active formula, but must never delete or zero the other mode’s saved values.

**Why:** Admins configure both formulas and switch between them. Treating the inactive mode as empty creates apparent data loss and risks overwriting a valid formula with zero defaults.

**How to apply:** Any vehicle pricing editor, API, import, or migration must preserve both mode histories, hydrate both latest mode values, and clearly distinguish the selected active formula from the saved inactive formula.