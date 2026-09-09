---
name: Admin location geocoding
description: Product and safety contract for converting admin-entered location names into coordinates.
---

Geocoding is an explicit, authenticated admin action. It runs only when the admin presses the lookup button, fills editable form fields and never saves a location automatically.

**Why:** Coordinates should be fetched once during catalog maintenance, reviewed by a human and then persisted through the normal location save flow. Public page-load geocoding would add latency, quota cost and an external dependency to customer journeys.

**How to apply:** Keep the Google key server-only. Build the query from location name plus optional district/city. Return a short address preview and provider accuracy type, but do not invent metre accuracy. Provider errors must leave manual entry usable. Enabling Geocoding API and allowing it in key restrictions is an external prerequisite.

For an explicitly authorized bulk backfill, collect all provider results before writing, use a fixed expected-row safety gate, update only successful rows in one transaction, preserve failed rows exactly, and retain a before/after CSV. Treat every non-`ROOFTOP` result as requiring manual review.