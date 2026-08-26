---
name: Image compression threshold system
description: Admin-configurable max-KB ceiling for permanent WebP uploads, plus the in-place backfill pattern used to shrink already-oversized images.
---

## Design
`site_settings.image_compression_max_kb` (singleton row, default 200) is the admin-configurable ceiling.
`lib/image-settings-server.ts` mirrors the `getContactSettings()` cache pattern (own 5-min cache,
`invalidateImageSettings()` called from the settings POST route). Recompression logic itself lives in
`lib/studio/image-media.ts::recompressWebpToBudget()`: steps WebP quality down through a fixed ladder
(82→76→70→64) with `effort: 6`, stopping at the first result under budget; never enlarges, never returns
something bigger than the input, and never goes below the quality-64 floor even if still over budget (silent
quality collapse is worse than an oversized image).

**Why an in-place-overwrite design, not a new-object-plus-DB-update design:** the object key/path never
changes — recompression re-uploads to the exact same object-storage key. This means a full-repo backfill
needs zero DB writes and cannot break a single link, because every `/api/storage/objects/...` URL already
stored anywhere (content JSON bodies, plain hero/og columns, vehicle gallery, blog markdown, etc.) stays
byte-identical after the pass.

## Known gap
The direct-browser-upload flow (`lib/storage/request-url-handler.ts` presigned PUT, used by manual image
pickers) puts bytes straight from the browser to storage — the app server never sees them, so this path is
NOT covered by automatic recompression. Only server-side upload paths are covered: AI Studio image
generation (`app/admin/api/studio/images/route.ts`) and one-off generation scripts
(`scripts/generate-hero-images.ts`, `scripts/service-section-image.mjs`). A backfill script
(`scripts/recompress-oversized-images.mjs`) exists to catch anything (including ones from the direct-upload
path) that ends up oversized regardless of origin — re-run it periodically or after any bulk image import.

## Backfill script location coverage
`scripts/recompress-oversized-images.mjs` scans for `/api/storage/objects/...` references across:
`content.body`/`draft_body` (JSON walk for SERVICE, markdown regex for BLOG_POST) + `hero_image`/`og_image`,
`vehicles.cover_image`/`og_image`/`gallery`, `studio_projects.cover_image_url`, `studio_images.object_path`/`url`,
`transfer_routes.image_path`. If a new table/column starts storing an object-storage image URL, add it here too.
