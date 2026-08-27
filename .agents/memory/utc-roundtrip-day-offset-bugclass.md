---
name: UTC round-trip day-offset bug class
description: Building a real zoned instant then converting it back through UTC/toISOString for calendar-date comparisons produces a deterministic, always-wrong-by-one-day bug — not just a midnight edge case. Derive calendar dates from Intl parts only.
---

A helper that builds a real Istanbul-local `Date` instant (e.g. midnight Europe/Istanbul) and then formats/compares it via UTC (`toISOString()`, `getUTCDate()`, etc.) will round-trip through UTC and land on the wrong calendar day for the whole zone offset window, every single day — not an occasional midnight-boundary glitch.

**Why:** Found in a dashboard "today's bookings" feature that was always off by one full day, deterministically, because its date-range helper built a real zoned instant and then let it get reinterpreted in UTC somewhere downstream. It looked like a "timezone edge case" bug report but was actually wrong 100% of the time, not just near midnight.

**How to apply:** For calendar-date arithmetic (today/tomorrow/yesterday in a specific timezone), derive the date purely from `Intl.DateTimeFormat` parts (year/month/day) for that timezone, do arithmetic on those parts directly, and never mix in a UTC round-trip of a zoned instant. Extract the helper into its own small module and cover it with unit tests for exact-midnight, just-before/after-midnight, and month/year-boundary cases — those tests catch this class of bug even when the "obvious" daytime case passes.
