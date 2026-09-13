---
name: Toll bulk percentage increases
description: Safety contract for applying an admin-entered percentage increase to current toll tariffs.
---

Bulk percentage increases update only existing, active, currently valid tariff rows with a non-null effective amount. They set the recalculated amount as the manual override on the same row; they never create tariff history rows or fill null amounts.

**Why:** A percentage increase must not invent missing prices, change tariff counts, or be applied twice after a double click or request retry.

**How to apply:** Preview from a hash of row identity, effective/manual/automatic amounts and update time. On confirmation, lock current rows in one transaction, reject a changed hash, round to integer kuruş, and record old/new amounts plus the normalized rate in an audit row. Serialize and replay the same idempotency key from audit without recalculating.