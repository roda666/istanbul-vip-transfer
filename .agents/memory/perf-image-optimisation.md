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

## AR RTL check quirk
`[lang]/layout.tsx` injects inline script: `h.setAttribute('dir','rtl')` — NOT in SSR `<html dir>` attribute.
Root layout has `suppressHydrationWarning`. Check for `setAttribute.*dir.*rtl` in raw HTML, not `<html dir="rtl">`.

## Google Fonts
Still loaded via CSS `@import` in globals.css. Added `<link rel="preconnect">` hints in layout.tsx to reduce font TTFB.
Switching to `next/font/google` was skipped because all inline styles use literal `fontFamily: 'Inter, sans-serif'` strings — hashed next/font names would break them without a full-codebase refactor.

## sharp
`pnpm.onlyBuiltDependencies: ['sharp']` added to package.json. `pnpm rebuild sharp` needed in fresh env.
Without compiled sharp, Next.js falls back to slower built-in optimizer — still works.
