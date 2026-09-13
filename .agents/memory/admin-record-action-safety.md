---
name: Admin record action safety
description: Project-wide safety and interaction rules for mutable admin record lists and cards.
---

Admin record lists use one consistent action contract: canonical record actions retain their fixed relative order, narrow screens expose one accessible “İşlemler” sheet, and unsupported actions are omitted rather than simulated.

Archive and restore must be explicit, validated state transitions. A permanent-delete endpoint must reject every non-archived record, even when the UI normally hides the delete action.

**Why:** A state-dependent DELETE that archives an active row but deletes an archived row can turn two rapid requests into an unintended permanent deletion. UI duplicate guards alone do not protect concurrent requests or alternate clients.

**How to apply:** For every mutable admin record surface, keep authorization, confirmation and audit behavior intact; expose only real actions. Use explicit archive/restore commands, keep restored rows inactive unless the lifecycle says otherwise, and require archived state again at the permanent-delete boundary.