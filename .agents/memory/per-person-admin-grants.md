---
name: Per-person admin grants
description: Authorization source-of-truth and route classification rules for non-super admin staff.
---

For non-`SUPER_ADMIN` staff, per-person section grants are the authorization source of truth. Legacy role permissions remain useful as a route inventory, but must not become a second gate that prevents an explicitly granted person from managing a section. `SUPER_ADMIN` remains an immutable full-access bypass.

**Why:** The product decision is person-based `Görüntüleyebilir` / `İşlem Yapabilir` access. Reapplying coarse legacy roles would make valid individual grants ineffective, while missing or mismatched section classification can either deny intended access or expose the wrong domain.

**How to apply:** Every protected admin page, API method, and sidebar destination must resolve to the same section. Missing mappings deny by default. Treat live-chat sessions/messages/reply/takeover/resolve as `chat`; treat knowledge/settings/report content as `chatbot`. Mutation controls must use manage capability; cancel/close controls may remain visible.