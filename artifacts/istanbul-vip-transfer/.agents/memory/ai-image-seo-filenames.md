---
name: AI image SEO filename convention
description: How AI-generated image object keys are named, renamed, and guarded — and the hidden serving-route trap this creates.
---

All AI-generated images (`ai-images/blog/<slug>/...`, `ai-images/service/<slug>/...`,
`ai-images/service/<slug>/section-images/...`) use a descriptive filename derived
from alt text, not a bare UUID: `word-word-word-<8hexsuffix>.webp`.

- Canonical builder: `lib/studio/image-filename.ts` (`buildSeoImageFilename`,
  `slugWords`, `isBareUuidFilename`). Turkish chars transliterated, stopwords
  dropped, 3–6 significant words, suffix = first 8 hex chars of a UUID.
- When **renaming** an existing image, the suffix reuses the first 8 hex chars
  of the OLD uuid filename (not a fresh one) — keeps old/new names traceably
  linked and guarantees uniqueness for free.
- `.mjs` scripts that can't import TS (`scripts/service-section-image.mjs`,
  `scripts/rename-ai-images-seo.mjs`) carry an inline duplicate of the same
  logic — keep both in sync if the rule changes.
- Directory structure (slug, `section-images/` subfolder) is unchanged — only
  the filename leaf uses this convention.

**Why:** a bare random-UUID filename wastes a real Google Images ranking
signal; the alt-text-derived name is free SEO value with no functional cost.

**Serving-route trap (bit us during the 2026-08-26 migration):** the public
image proxy (`artifacts/api-server/src/routes/storage.ts`, `isAiImage` regex)
and `lib/instagram-image.ts`'s cover-image validator both **hardcoded the old
36-char-UUID-only filename pattern**. Renaming images without updating these
made every AI image 403 until fixed. Worse, the api-server regex never
accounted for the `section-images/` subfolder at all, so those images had
*always* been silently 403ing even before the rename. Any future filename- or
path-convention change for `ai-images/*` must grep both files (and the admin
attach-schema regex in `app/admin/api/studio/images/route.ts`) for the same
hardcoded pattern.

**How to apply:** before changing how an `ai-images/...` object is named or
pathed, grep the whole repo for `ai-images/` regexes (server route, admin
API validators, any client-side URL matchers) — there is no single source of
truth for "what filenames are valid," each guard duplicates the rule.

Companion pieces added alongside the rename:
- `scripts/check-image-filenames.mjs` — prebuild guard, fails on any
  remaining bare-UUID AI image filename or empty alt text (wired into
  `pnpm prebuild` as `check:image-filenames`).
- `app/image-sitemap.xml/route.ts` — hand-rolled Google Images XML sitemap
  (Next's `MetadataRoute.Sitemap` has no `<image:image>` support); registered
  in `app/robots.ts`'s `sitemap` array alongside `/sitemap.xml`.
- `scripts/rename-ai-images-seo.mjs` — resumable/idempotent one-off migration:
  copy old→new key, verify readable, rewrite every DB reference (content
  body/hero/og, content_translations body, vehicles, studio_projects,
  studio_images, transfer_routes), only then delete the old key. Safe to
  re-run — it only touches URLs that still resolve to a bare-UUID filename.
