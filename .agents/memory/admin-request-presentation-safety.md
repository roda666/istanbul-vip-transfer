---
name: Admin request presentation safety
description: The durable contract for showing reservation request JSON in admin detail, PDF and Excel.
---

Admin request detail, single-request Excel and single-request PDF must use one grouped allowlist presentation model. Never append or render arbitrary `requestData` entries.

**Why:** Reservation payloads contain duplicate canonical contact fields, location UUIDs, internal reference objects and nested communication metadata. Generic `Object.entries()` rendering leaked IDs and produced `[object Object]` in every admin-facing surface.

**How to apply:** Add legitimate fields deliberately to the shared presentation model with a Turkish label and safe formatter. Expand selected operational objects into meaningful status rows. Keep unknown keys hidden by default and cover all three surfaces in the same regression fixture.