---
name: Vehicle pricing mode persistence
description: Product rule for retaining and independently activating distance and hourly formulas.
---

Each vehicle keeps the latest saved distance formula and hourly formula independently. DISTANCE and HOURLY may both be active at once. Creating or activating a version deactivates only other active versions for the same vehicle and the same mode; it must never change the other mode.

**Why:** The quote mode selects the matching formula at calculation time. Vehicle-wide mutual exclusion incorrectly disables a valid formula for the other calculation mode and makes one pricing path unavailable.

**How to apply:** Any vehicle pricing editor, API, import, or migration must preserve both mode histories, scope active-version replacement by vehicle plus mode, and hydrate the latest saved formula for each mode independently.