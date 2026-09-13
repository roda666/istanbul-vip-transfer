---
name: Admin form route-state reuse
description: Prevents stale or empty form state when create and edit routes share a client component.
---

When an admin create route and an edit route render the same client form component, initialize from props and resynchronize whenever the record identity changes. Do not assume route navigation always remounts the client component.

**Why:** Next navigation can preserve the client component across related routes. State initialized only once can carry the blank create form or a previous record into an edit screen even though the server supplied the correct record.

**How to apply:** For shared create/edit forms, key the component by record identity or use an identity-dependent synchronization effect. Keep edit mutations bound to the server-provided identity, never to a mutable form field.