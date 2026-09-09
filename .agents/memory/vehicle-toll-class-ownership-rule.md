---
name: Vehicle toll-class ownership rule
description: Records the global official toll-class policy and how to handle physical axle-count uncertainty.
---

Use one global official toll class per vehicle. Vehicle type and base-fare pricing category must never infer or overwrite it; toll bans and tariffs use only the verified class.

**Why:** Type-based defaults incorrectly proposed class 1 for Volkswagen Transporter and can hide wheelbase/axle differences. The owner explicitly confirmed Transporter class 2 must be preserved.

**How to apply:** Assign only from official vehicle evidence or a preserved owner-confirmed value. Leave uncertain vehicles unassigned/review-required; never change tariff amounts while classifying vehicles.