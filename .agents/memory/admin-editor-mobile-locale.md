---
name: Admin editor — mobile + locale isolation fixes
description: Mobile responsiveness, locale tab isolation, dirty-state guard, and translation FK fix for the Ana Sayfa editor.
---

## Key decisions

**isDirty guard** — `updateSections` only calls `setIsDirty(true)` when `activeLocale === 'tr'` (the editable source). Other tabs are read-only; marking them dirty would be wrong.

**handleLocaleSwitch** — wraps `setActiveLocale` with a `window.confirm` guard when `isDirty && activeLocale === 'tr'`. After dismiss or confirm, `setIsDirty(false)` is reset before switching.

**saveDraft status** — after a successful save, the record is always set to `'DRAFT'` client-side regardless of prior status. Never preserve `'PUBLISHED'` after an edit.

**Mobile CSS classes** — `hpe-field-input` / `hpe-field-ta` on every Field's input/textarea; `hpe-locale-tabs` on the locale tab row. At ≤767px:
  - `hpe-field-input, hpe-field-ta { font-size: 16px !important }` (prevents iOS Safari auto-zoom; !important overrides the 13px inline style)
  - `hpe-locale-tabs { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch }`

**Translation FK violation** — `content_translations.updated_by` has a FK → `admin_users.id`. If the admin is deleted before an async translation job writes back, the UPDATE throws `updated_by_fkey`. Fix: wrap the update in try-catch; on FK error retry with `updatedBy: null`.

**Why:**
- iOS Safari zooms inputs < 16px — !important needed because inline `style` beats stylesheet unless the class wins via specificity or !important.
- The confirm dialog prevents accidental loss of unsaved TR content when switching tabs.
- The FK fallback prevents real users hitting 500 errors if a session admin account is deleted while a translation is in flight.

**How to apply:**
- Any new form field in the editor should use the Field component (gets the classes automatically).
- The `entity_id` column in `content_translations` is type `TEXT`, not `UUID`. When joining with `content.id` (UUID) in raw SQL, use `ct.entity_id = c.id::text` (not `= c.id`).
- Test admin users created for scripts must be deleted AFTER the script completes (not before async jobs finish).
