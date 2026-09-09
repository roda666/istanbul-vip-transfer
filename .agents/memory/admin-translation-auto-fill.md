---
name: Admin translation auto-fill
description: Durable overwrite-safety rule for AI translation after Turkish admin saves.
---

Turkish is the canonical source. On admin save, generate EN/DE/RU/AR/FR/ES/IT/NL only for missing or blank translated fields. Never replace a non-empty translated value; explicit lock flags remain an additional hard stop where the entity has them.

**Why:** Admins must be able to correct AI copy manually without a later Turkish save silently destroying their work. Some entities store translations as JSON maps and do not have per-field lock metadata, so “non-empty means locked” is the consistent cross-entity rule.

**How to apply:** Merge AI output field-by-field into empty targets, and accept only keys requested from the model; unexpected model keys must never overwrite saved values. Keep existing lifecycle/publication status for existing translation rows, create new rows as drafts where approval is required, and fail visibly if required AI output cannot be generated.