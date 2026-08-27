---
name: Legacy redirect ID-pattern matching
description: Why old-site (ASP.NET) legacy URL redirects in next.config.ts must match on trailing -<id>-<section>, not on the full slug text, and how the final domain rule behaves.
---

The old site's URLs follow `/slug-<id>-<section>` (e.g. `-107-8` for services, `-5` for blog,
`-12` day tours, `-13` vehicles, `-2` corporate/legal, `-1` about-us family). The same page was
indexed under multiple different slug texts over time (typos, English wording, double hyphens)
while the trailing `-<id>-<section>` stayed stable for a given target page.

**Rule:** every legacy-URL redirect whose old address carries a numeric id+section suffix must
use a Next.js `source` pattern that wildcards the slug and pins only the suffix, e.g.
`source: '/:s(.*)-107-8'` — not a hardcoded exact-string slug. This makes unknown/future slug
variants for the same id resolve correctly without needing a new rule per variant.

**Why:** exact-slug rules silently miss real Search Console traffic hitting the same logical
page under a different slug spelling sharing the same id — confirmed 2026-08-27 (e.g.
`kurumsal-transfer-107-8` rule missed the actual high-traffic
`istanbul-bursa-ulasim-transfer-hizmetleri-107-8`).

**How to apply:** when adding/auditing any `/slug-id-section` legacy redirect, check whether
that id already has a rule under a different slug spelling before adding a new one — many
"missing" legacy URLs turn out to share an id with an existing rule and are automatically
covered once that rule is pattern-based. For a section where literally everything maps to one
destination (e.g. all `-13` vehicle pages → `/araclar`), use a fully generic
`source: '/:s(.*)-:id(\\d+)-13'` instead of enumerating ids.

Also: the final `/:path*` rule (matched only when `host === 'istanbulviptransfer.com'`, i.e. the
bare non-www domain) is a **canonical-domain hop preserving the path**, not a homepage catch-all
— it forwards to the same path on `www.`, so any legacy URL unmatched by earlier rules still
404s downstream instead of silently landing on the homepage.
