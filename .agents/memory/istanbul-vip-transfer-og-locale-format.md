---
name: og:locale format bug (Istanbul VIP Transfer)
description: getOgLocale() reuses hreflang's BCP47 hyphen format for og:locale, which must use underscore.
---

`lib/i18n/seo.ts`'s `getOgLocale()` returns `LOCALE_BCP47` values (hyphenated, e.g. `tr-TR`, `en-GB`) built for hreflang. Open Graph's `og:locale` requires underscore format (`tr_TR`, `en_GB`). Several page templates (category, `[lang]` blog list/detail, `[lang]` catch-all service, `[lang]` legal, `[lang]` route detail, `[lang]` homepage, TR route detail) pass this straight into `openGraph.locale`, producing wrong-format `og:locale` on those pages, while a handful of hand-written top-level static service pages hardcode the correct `tr_TR` instead of calling the helper.

**Why:** discovered during the 2026-08-26 pre-launch SEO audit via live curl (`/guzergah/istanbul-ankara` → `og:locale="tr-TR"`, `/en` → `og:locale="en-GB"`).

**How to apply:** if asked to fix OG/social metadata, don't just patch the pages that call `getOgLocale()` — either fix the helper to emit underscore format for OG use (keeping a separate hreflang-format helper) or add a dedicated `getOgLocaleUnderscore()`, then re-point all 8 templates plus confirm the static pages that already hardcode `tr_TR` remain correct.
