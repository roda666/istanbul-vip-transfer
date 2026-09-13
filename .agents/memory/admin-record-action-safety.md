---
name: Admin record action safety
description: Project-wide safety and interaction rules for mutable admin record lists and cards.
---

Admin record lists use one consistent action contract: canonical record actions retain their fixed relative order, narrow screens expose one accessible “İşlemler” sheet, and state-blocked actions remain visible but disabled with a specific Turkish reason.

Archive and restore must be explicit, validated state transitions. A permanent-delete endpoint must reject every non-archived record, even when the UI normally hides the delete action.

Ordered location moves use one shared transaction-scoped advisory lock, lock the active ordering set, and exchange only the target and adjacent peer's order values. They must not touch updater or timestamp fields.

**Why:** A state-dependent DELETE that archives an active row but deletes an archived row can turn two rapid requests into an unintended permanent deletion. A previous reorder loop also renumbered the entire live location catalog while testing a two-row move. UI duplicate guards alone do not protect concurrent requests or alternate clients.

**How to apply:** Keep authorization, confirmation and audit behavior intact. Use explicit archive/restore commands, require archived state at permanent-delete boundaries, show blocked business-rule actions as disabled with reasons, and regression-test ordered moves as exactly two updates.