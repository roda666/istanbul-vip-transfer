---
name: Admin request presentation safety
description: The durable contract for showing reservation request JSON in admin detail, PDF and Excel.
---

Admin request detail, single-request Excel/PDF and multi-request Excel/PDF must derive their labels and values from one allowlisted presentation model. Never append or render arbitrary `requestData` entries.

**Why:** Reservation payloads contain duplicate canonical contact fields, location UUIDs, internal reference objects and nested communication metadata. Generic `Object.entries()` rendering leaked IDs and produced `[object Object]` in every admin-facing surface.

**How to apply:** Add legitimate fields deliberately to the shared presentation model with a Turkish label and safe formatter. Expand selected operational objects into meaningful status rows. Composite source codes must be parsed there, not in individual exporters. Multi-row PDF output is a landscape table with cell wrapping and repeated page headers; never serialize rows with pipe separators or byte slicing. Keep unknown keys hidden by default and cover every export surface in the same regression fixture.