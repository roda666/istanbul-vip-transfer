---
name: SEO fixes August 2026
description: Canonical URL fix for localized pages, double H1 fix, ContactPage/LocalBusiness schema improvements.
---

## Canonical URL fix
**File:** `app/[lang]/page.tsx`  
**Problem:** `alternates.canonical` was set to `buildAlternates('/')` which always returns the TR root URL (`https://istanbulviptransfer.com/`). Every localized homepage (`/en`, `/de`, etc.) canonicalized to the TR root — a serious SEO duplicate-content signal.  
**Fix:** Changed to `` canonical: `${SITE.siteUrl}/${lang}` `` so each locale self-canonicalizes.

**Why:** Each locale URL must canonical to itself, not to another locale's URL.

## Double H1 fix
**File:** `components/HakkimizdaArticle.tsx`  
**Problem:** `PageHero` renders an `<h1>` for the page title. `HakkimizdaArticle` also rendered its article heading as `<h1>`. Two H1s on one page.  
**Fix:** Changed article heading from `<h1>` to `<h2>`.

**Why:** Multiple H1s dilute SEO signals; heading hierarchy must be preserved.

## ContactPage schema
**File:** `app/iletisim/page.tsx`  
Added `@type: ContactPage` schema with embedded `LocalBusiness` for better structured data on the contact page. Previously only had `BreadcrumbList`.

## LocalBusiness schema enrichment
**File:** `app/page.tsx`  
Added to `localBusinessSchema`:
- `@id`: `${BASE}/#business`
- `address`: PostalAddress with addressLocality/Country
- `geo`: GeoCoordinates (41.0082, 28.9784)
- `openingHoursSpecification`: 24/7
- `image`, `serviceType`, `knowsLanguage`
- `sameAs`: filtered to remove empty values

## Remaining SEO items (not yet fixed)
- `app/araclar/page.tsx`: still only BreadcrumbList, no Vehicle/ItemList schema
- `app/hakkimizda/page.tsx`: still only BreadcrumbList, no AboutPage/Organization schema
- Legal pages (`app/yasal/[slug]/page.tsx`): missing 9-language hreflang
- `buildAlternates()` pattern: callers in `app/[lang]/` routes set their own canonical; `app/[lang]/[...slug]/page.tsx` may still have the same canonical bug for non-homepage localized routes
