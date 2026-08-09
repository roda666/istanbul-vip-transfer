---
name: Homepage CMS auto-publish
description: Homepage editor bypasses approval workflow — TR save auto-publishes all 5 locales immediately. Other content types (blog, service, AI articles) keep manual approval.
---

## Behavior
- `PATCH /admin/api/homepage/tr` with `autoPublish: true` (default):
  - Sets TR `content.status = 'PUBLISHED'` + `publishedAt`
  - Runs AI translation for EN/DE/RU/AR
  - Sets each translation `status = 'PUBLISHED'` + `publishedAt` inline
  - Returns `syncResults` with `status: 'published'` (or 'failed'/'skipped')
- Button label: "🌐 Kaydet ve Tüm Dillerde Yayımla"
- Toast reports per-locale: "🌐 Yayımlandı: TR, EN, DE, RU, AR"

## SyncResult type
- Must include `'published'` in the union: `'skipped' | 'queued' | 'translated' | 'published' | 'locked_outdated' | 'failed'`

## TranslationInfoPanel (homepage-specific)
- Removed: onSubmitReview, onApprove props and buttons
- Kept: onRetry (for FAILED), onPublish (edge-case after retry), onUnpublish, onLock/onUnlock
- Status DRAFT/REVIEW/APPROVED → shows "🚀 Yayımla" for edge-case manual publish

## Mobile CSS (breakpoint at 900px)
- Changed from `max-width: 767px` to `max-width: 900px`
- `.hpe-grid` → `display: block !important` (not just grid-template-columns: 1fr)
- `.hpe-fg2, .hpe-fg3` → `display: block !important`
- Note: `getComputedStyle().gridTemplateColumns` still reports "1fr 1fr" even with display:block — this is expected CSS behavior; visual layout is single-column.

## Removed from editor
- `autoTranslate` state and `AutoTranslatePanel` component
- `targetLocales` state and `toggleLocale` function
- `bulkPublish` function and "Toplu Yayınla" button
- `submitForReview`, `approveTranslation` functions
- `bulkPublishing` state

## Approval workflow still enforced
- `publish/route.ts` still validates APPROVED→PUBLISHED for manual publish
- Homepage auto-publish bypasses this by writing directly to DB in the PATCH route
- Blog, hizmet, AI makale content types: unchanged (manual DRAFT→REVIEW→APPROVED→PUBLISHED)

**Why:** User requirement — homepage changes should be live immediately across all languages. Approval flow creates friction for frequent copy updates. Other content types need editorial review.
