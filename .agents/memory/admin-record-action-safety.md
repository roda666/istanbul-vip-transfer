---
name: Admin record action safety
description: Project-wide safety and interaction rules for mutable admin record lists and cards.
---

Admin record lists use one consistent action contract: canonical record actions retain their fixed relative order, narrow screens expose one accessible “İşlemler” sheet, and state-blocked actions remain visible but disabled with a specific Turkish reason.

Archive and restore must be explicit, validated state transitions. A permanent-delete endpoint must reject every non-archived record, even when the UI normally hides the delete action.

Vehicles have an additional permanent-delete boundary: the vehicle must be inactive and must never have been published. An inactive, never-published vehicle may be deleted from DRAFT, RESEARCH, REVIEW, or ARCHIVED state; quote dependencies still block deletion.

Confirmation state must close in `finally` after archive/restore actions as well as deletes. A successful mutation that leaves its modal overlay open is an incomplete admin action because it blocks the next UI operation.

Ordered location moves use one shared transaction-scoped advisory lock, lock the active ordering set, and exchange only the target and adjacent peer's order values. They must not touch updater or timestamp fields.

**Why:** A state-dependent DELETE that archives an active row but deletes an archived row can turn two rapid requests into an unintended permanent deletion. Previously published vehicles must remain auditable even after deactivation. A previous reorder loop also renumbered the entire live location catalog while testing a two-row move, and an archive modal once stayed open after a successful request. UI duplicate guards alone do not protect concurrent requests or alternate clients.

**How to apply:** Keep authorization, confirmation and audit behavior intact. Apply each record type's explicit permanent-delete boundary, show blocked business-rule actions as disabled with reasons, close confirmation overlays after settled mutations, and regression-test ordered moves as exactly two updates.