---
name: Public i18n system
description: Full i18n wiring for all public-facing components; key constraints and gotchas.
---

# Public i18n System

All public components use `useLang()` from `@/lib/i18n/context` to get `{ lang, dict }`.

## Key files
- `lib/i18n/types.ts` — Dictionary interface (all keys documented here)
- `lib/i18n/dictionaries/[tr|en|de|ru|ar].ts` — 5 language files
- `lib/locale-path.ts` — `localePath(path, lang)` helper; all internal links must go through this
- `lib/nav-config.ts` — `getNav(lang, dict)` factory for locale-aware nav entries
- `middleware.ts` — admin auth + `ivt_lang_pref` cookie persistence (locale redirect on `/`)
- `app/[lang]/layout.tsx` — wraps with `<LangProvider forceLang={lang}>`; exists, DO NOT recreate

## Component wiring pattern
```tsx
const { lang, dict } = useLang();
const p = (path: string) => localePath(path, lang);
```

## Critical gotcha — Turkish apostrophes in JS string literals
Turkish strings like `"Havalimanı'ndan"` contain apostrophes. Using single-quote JS strings
(`'Havalimanı'ndan'`) causes a parse error. **Always use double-quotes** for Turkish strings in JS/TSX.

**Why:** SWC/webpack fails with `Expected ':'` syntax error when a Turkish apostrophe appears inside a single-quoted JS string.

**How to apply:** Whenever writing Turkish text directly in `.tsx`/`.ts` files, use double-quote string delimiters, or backtick template literals.

## Never prefix these paths
`/admin`, `/api`, `/_next`, `/data`, `wa.me`, `tel:`, `mailto:`, static asset extensions.

## Locale persistence
- `ivt_lang_pref` cookie (1-year, path=/) written by middleware
- Visiting `/en` stamps cookie `en`; visiting `/` stamps `tr`
- Fresh `/` visit with non-`tr` cookie → 302 redirect to `/{pref}`
