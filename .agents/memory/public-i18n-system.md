---
name: Public i18n system
description: Full i18n wiring for all public components; locale persistence architecture; catch-all routing for Turkish pages under locale prefixes.
---

## Turkish string apostrophe rule
Turkish strings in `.ts`/`.tsx` literals must use double-quotes — SWC parse error otherwise.

## LangProvider detection
`LangProvider` (no `forceLang`) auto-detects lang from `usePathname()` by checking the first URL segment.
- `/en/hizmetler` → detects `en` → Header/Footer render in English ✓
- `[lang]/layout.tsx` passes `forceLang={lang}` for the page-level LangProvider
- `PublicLayoutWrapper` provides the outer LangProvider for Header/Footer/WhatsApp

## Catch-all locale routing
`app/[lang]/[...slug]/page.tsx` maps Turkish slug keys to their page components.
- Enables `/en/hizmetler`, `/de/istanbul-havalimani-transfer`, etc.
- MUST use `slug` (not `path`) to match the `[lang]/blog/[slug]` dynamic segment name — Next.js requires same param name for overlapping routes.
- `robots: { index: false }` on this catch-all — Turkish canonical URLs remain authoritative.

## Middleware locale cookie rules
- `urlLang` detected (e.g. `/en/*`) → stamp cookie with that lang
- Root `/` with non-TR cookie → redirect to `/{pref}`
- Turkish sub-pages (e.g. `/hizmetler`) → do NOT stamp `tr` — only stamp on first root visit (no cookie yet). This prevents an English user clicking a Turkish URL from losing their language preference.

## Locale-aware link helpers
- `lib/locale-path.ts` → `localePath(path, lang)` — strips existing prefix, adds new one (tr = no prefix)
- `components/LocaleLink.tsx` — `'use client'` wrapper that auto-calls `localePath`; skips https://, tel:, mailto:, /admin, /api, /_next
- `components/HizmetlerServiceGrid.tsx` — client grid that calls `getNav(lang, dict)` so service links are always locale-prefixed
- `components/PageHero.tsx` — uses `useLang()` + `localePath()` to make breadcrumb hrefs locale-aware

## Dict/type change chain
`lib/i18n/types.ts` → `lib/i18n/dictionaries/[lang].ts` (all 5) → component

**Why:** All 5 language dicts must be updated together or TypeScript errors on missing keys.
