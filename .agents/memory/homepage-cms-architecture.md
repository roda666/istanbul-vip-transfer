---
name: Homepage CMS Architecture
description: How homepage content is stored, served, and edited (Phase 1 implementation decisions).
---

## Data storage

- **TR source** — reuses existing `content` table; slug `ana-sayfa`, contentType `PAGE`, `body` = JSON string of `HomepageSections`.
- **EN/DE/RU/AR** — `contentTranslations` table; `entityType='homepage'`, `entityId` = content.id of TR row.
- **Google reviews** — new `google_reviews` table (created via direct DDL after drizzle-kit journal conflict; see below).
- **Static fallback** — `HOMEPAGE_FALLBACK` in `lib/homepage-types.ts` mirrors all 5 locales; page renders correctly if DB is unavailable.

## Key interfaces

- `HomepageSections` — 10 typed section keys (hero, heroStats, servicesSection, trustSection, vehiclesSection, reviewsSection, reservationSection, contactSection, footerSection, seo).
- `HomepageAdminRecord` — returned by `getHomepageAdminRecord(locale)`; includes status, publishedAt, updatedAt, and parsed sections.
- `HomepageCmsProvider` / `useHomepageCms()` — client context; pass `getPublishedHomepageData(locale)` result from server component.

## Public rendering pattern

```tsx
// app/page.tsx (TR) and app/[lang]/page.tsx (other locales)
const cmsData = await getPublishedHomepageData(locale);
return <HomepageCmsProvider data={cmsData}>{...}</HomepageCmsProvider>;
```

Components read `useHomepageCms()` with i18n dict as fallback. Hero.tsx is the Phase 1 proof-of-concept component.

## Admin routes

- `GET/PATCH /admin/api/homepage/[locale]` — fetch/save draft
- `POST /admin/api/homepage/[locale]/publish?action=publish|unpublish` — publish/unpublish; calls `revalidatePath`
- `GET/POST /admin/api/homepage/reviews` — list/create Google reviews
- `PATCH/DELETE /admin/api/homepage/reviews/[id]` — update/delete
- `POST /admin/api/homepage/media` — presigned GCS upload URL (needs `@google-cloud/storage`)

## Admin editor

- Route: `/admin/sayfalar/ana-sayfa`
- Locale tabs (TR/EN/DE/RU/AR) + section tabs (A–J)
- Server component pre-loads TR record; client loads other locales on demand.

## `google_reviews` migration quirk

**Why:** Drizzle-kit migration 0006 was journaled as applied but the `CREATE TABLE` silently didn't execute (likely a journal timestamp or snapshot mismatch). Fixed by running the DDL directly via `psql $DATABASE_URL`. If this happens again, run the SQL manually and do NOT re-run drizzle-kit migrate (it will say "already applied").

## Seed script

`scripts/seed-homepage.ts` — idempotent; checks `body` is null before overwriting. 11 Google reviews seeded (TR×2, EN×3, DE×2, RU×2, AR×2). Subsequent runs skip existing records.
