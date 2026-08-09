---
name: Homepage translation approval workflow
description: State machine for homepage translation lifecycle — routes, UI buttons, bulk-publish rules, mobile Çeviriler page.
---

## State machine
NOT_STARTED → TRANSLATING → DRAFT → REVIEW → APPROVED → PUBLISHED

## /admin/api/homepage/[locale]/publish route
- `?action=submit_review`: DRAFT → REVIEW (enforced; returns 409 if not DRAFT)
- `?action=approve`: REVIEW → APPROVED (enforced; returns 409 if not REVIEW)
- `?action=publish`: APPROVED → PUBLISHED (enforced; returns 409 if not APPROVED)
- `?action=unpublish`: any → DRAFT (no constraint)
- TR source only supports publish/unpublish (no review/approve)

**Why:** spec requires each step to be independently reviewable; skipping REVIEW was the original bug (DRAFT was approved directly).

## HomepageEditor TranslationInfoPanel
- DRAFT → shows "📤 İncelemeye Gönder" (calls submit_review)
- REVIEW → shows "✓ Onayla" (calls approve)
- APPROVED → shows "🚀 Yayınla" (calls publish, has confirm dialog)
- PUBLISHED → shows "Yayından Kaldır"
- `onSubmitReview` prop must be wired in `TranslationInfoPanel` call

## Bulk publish
- `/admin/api/homepage/bulk-publish`: only publishes records with status APPROVED; skips all others
- Editor adds `window.confirm` before calling bulk-publish
- Toast reports published locales and skipped locales separately

## /admin/ceviriler mobile (< 768px)
- CSS class `.ct-table-wrap` hidden; `.ct-cards` shown (flex column, gap 10px)
- Each card: content name, language, status, source, updated date, action buttons
- Mobile action buttons: `min-height: 44px` (touch target)
- Desktop table uses `.ct-tbl-btn` (compact, no min-height override)

## FK constraint trap
- `content.approved_by` and `content_translations.approved_by` have FK → `admin_users.id`
- Deleting a test admin that was used as approvedBy fails unless references are nulled first
- Fix: `UPDATE content SET approved_by=NULL WHERE approved_by IN (SELECT id FROM admin_users WHERE email=...)` before DELETE

**How to apply:**
- Always null FK references before deleting test admin users
- Check `content`, `content_translations`, `audit_logs` tables for admin user references
