---
name: Toll resolution has two parallel implementations that must be updated together
description: getRouteTollAlternatives (admin listing/comparison) and resolveTolls (actual quote resolver) independently implement the same ban/pricing rules — a fix applied to one is invisible in the other unless both are touched.
---

## Two call sites compute "is this toll alternative usable for this vehicle", not one

`lib/toll-management.ts` → `getRouteTollAlternatives()` powers the admin listing/comparison UI (badges, `missingTariffPointNames`, `bannedPointNames`, per-vehicle `totalKurus`). `lib/admin-pricing-service.ts` → `resolveTolls()` is the actual quote-generation path invoked when a real price is produced. Both independently re-implement: vehicle-class ban check, vehicle-type ban check, GATE_PAIR entry/exit-gate matching, and the "exactly one matching tariff row or treat as missing" rule.

**Why:** these evolved separately (listing UI came first, the quote resolver was added/extended later) and there is no shared helper — each is a hand-written loop over points/tariffs.

**How to apply:** any new hard-block rule (a new ban axis, a new pricing-mode edge case, a new "must have exactly one match" constraint) must be added to **both** functions in the same change, or the admin UI will show a rule being enforced while real customer quotes silently ignore it (or vice versa). When debugging "the UI says X but the actual price didn't reflect it" (or the reverse), check whether the fix landed in only one of the two functions.
