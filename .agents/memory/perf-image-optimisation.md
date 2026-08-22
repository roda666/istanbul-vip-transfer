---
name: Performance & image optimisation
description: next.config.ts image settings, CWV pipeline, quality gate — decisions to stay consistent with.
---

# Performance & Image Optimisation

## Rule
`images.unoptimized: true` was the root cause of broken Core Web Vitals across all pages. It is now removed. Never add it back unless switching to `output: 'export'` (static export mode).

**Why:** It disabled WebP/AVIF conversion, responsive sizing, and lazy-load for every `<Image>` on the site.

## Image remotePatterns
Only two patterns needed:
- `storage.googleapis.com` — Replit Object Storage (GCS) for admin-uploaded images
- `**.replit.dev` — dev/staging preview domains

Blog hero images use plain `<img loading="lazy" decoding="async">` with explicit width/height — admin enters arbitrary external URLs so domain enumeration is impossible.

## web-vitals pipeline
- `web-vitals` (v6) installed as dependency
- `components/WebVitalsReporter.tsx` — client component, dynamic import, sendBeacon to `/api/vitals`
- `app/api/vitals/route.ts` — logs CLS/INP/LCP/FCP/TTFB to server console; extend to DB/analytics later
- Mounted in `app/layout.tsx` (root layout, all public + admin pages)

## Quality gate
- `scripts/perf-check.ts` — HTTP fetch-based; no Chrome required; checks title, canonical, H1, img alt, meta description, OG image, RTL script, render-blocking scripts
- `pnpm test:perf` → `tsx scripts/perf-check.ts`
- `pnpm test:perf:browser` → `playwright test tests/perf.spec.ts` (needs `playwright install --with-deps chromium` on NixOS)
- Gate: exit code 1 on any error; TTFB threshold 800 ms (warns, not errors, in dev)

## AR RTL check
The locale-aware root layout renders the correct direction directly on the SSR
`<html>` element. Quality checks should accept that rendered `dir="rtl"` form;
the old inline-script-only assumption is stale.

## Mobile LCP and entrance motion
Keep header, homepage hero, and service PageHero entrance animations disabled
below the mobile breakpoint. Critical content must render fully visible on the
first frame.

**Why:** opacity/transform entrance animations can prevent the hero from
becoming the LCP candidate, letting smaller header, breadcrumb, or cookie text
win instead. A fresh 390px browser check then identified the intended hero
subheadline/image as LCP, below the 2.5-second target.

**How to apply:** preserve the richer motion treatment on desktop, but include
new critical above-fold animated classes in the mobile no-animation rule.
After any new hero or consent UI work, verify the final LCP entry with a
buffered PerformanceObserver as well as lab auditing.

## Critical hero priority and visibility
For a hero that Lighthouse identifies as LCP, pass `fetchPriority="high"` in
addition to Next Image's `priority`. The VIP service route also needs a
responsive image preload in the document head that matches the optimizer
`srcset` and `sizes`.

**Why:** `priority` alone did not expose a high-priority image request to the
Lighthouse audit. The homepage text LCP also retained its CSS entrance delay in
lab measurements despite a mobile stylesheet override; making the critical
element explicitly visible in its initial inline style removed that delay.

**How to apply:** retain responsive optimizer URLs in a manual preload rather
than preloading the raw source image, which could create a duplicate download.
Never apply a delayed opacity/transform effect to an element that can become
the mobile LCP candidate.

## Google Fonts
Still loaded via CSS `@import` in globals.css. Added `<link rel="preconnect">` hints in layout.tsx to reduce font TTFB.
Switching to `next/font/google` was skipped because all inline styles use literal `fontFamily: 'Inter, sans-serif'` strings — hashed next/font names would break them without a full-codebase refactor.

## sharp
`pnpm.onlyBuiltDependencies: ['sharp']` added to package.json. `pnpm rebuild sharp` needed in fresh env.
Without compiled sharp, Next.js falls back to slower built-in optimizer — still works.
