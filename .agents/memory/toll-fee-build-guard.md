---
name: Toll/crossing-fee build-time guard
description: How the permanent build guard against customer-visible bridge/tunnel/highway/ferry fee mentions is designed, and its known regex-coverage limits.
---

## What it does
`artifacts/istanbul-vip-transfer/scripts/check-toll-fee-mentions.mjs` fails the build (exit 1) if any PUBLISHED customer-visible copy (content + content_translations across BLOG_POST/SERVICE/PAGE, plus transfer_routes + transfer_route_translations JSONB fields) mentions the **price** of a bridge/tunnel/highway/ferry crossing. Pure geography mentions ("the route crosses a bridge") are intentionally allowed. Wired into `pnpm prebuild`. Has its own self-test: `scripts/test-check-toll-fee-mentions.mjs` plants a real violation row, asserts the checker fails and names it, deletes it, asserts a clean pass.

## Why per-language rule sets, not cross-language regex
Cross-language substring matching produces false positives (see multilingual-content-audit-regex-traps.md). Each language has its own `direct` (standalone words that already mean "toll", e.g. Maut/péage/pedaggio — one hit is a violation on its own) + `geo` (bridge/tunnel/highway/ferry terms) + `fee` (generic money words) lists; a violation requires `geo` AND `fee` in the same sentence, OR a `direct` hit alone.

## SERVICE content is JSON, not prose
`content.body` for content_type='SERVICE' is a JSON blob (hero/features/seo/introBody/contentSections/faqs/serviceArea), not plain text. The checker must `JSON.parse` and walk leaf strings individually (`collectStrings()`), never treat the raw blob as one string — otherwise unrelated JSON fields glue together into fake "sentences" that trigger false positives (e.g. a day-tour's entrance-fee FAQ merging with an unrelated ferry FAQ elsewhere in the same blob).

## Known regex-coverage lessons (fixed once found, but re-check if similar terms are added)
- Italian plural: match the shorter stem ("pedaggi") not the singular ("pedaggio") — a plural is not always a suffix of the singular, so `tokenRe`'s trailing-letters allowance only helps if the shorter form is the pattern root.
- Russian generic transit fee "сборы за проезд" needed its own direct pattern (`сбор\p{L}*\s+за\s+проезд`) separate from the "плата за проезд" / "дорожный сбор" patterns already covered.
- Turkish "gider" (expense) collides with "giderken" (while going) — needs `(?!ken)` negative lookahead. Spanish "coste" collides with "costera/costero" (coastal) — needs `(?!r)`.
- English "fee" as a `tokenRe('fee')` (with its trailing `\p{L}*` suffix allowance) also matches "**fee**l"/"**fee**d" — any short (3-4 letter) root is unsafe with the generic wildcard-suffix `tokenRe` helper. Fixed by using an exact-form regex (`/\bfees?\b/`) instead of `tokenRe` for that one term. Before adding a new short fee/geo root in any language, sanity-check it against common real words in that language, not just against the toll-related vocabulary.

## Known remaining gap (not yet closed, low priority — user did not ask for it)
The **runtime** render-layer filter `removeCustomerVisibleTollCopy()`/`TOLL_FEE_TERMS` in `lib/customer-visible-copy.ts` (separate from this build-time guard) deletes the whole sentence rather than rewriting it, is missing ferry/feribot terms, and has an unresolved Italian boundary issue. Not in scope unless the user explicitly asks for it.
