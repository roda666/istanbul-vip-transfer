---
name: Service section inline image batch tool
description: How to generate and place CMS in-content images for service pages (scripts/service-section-image.mjs); reuse this for future batches instead of writing a new one-off pipeline.
---

`scripts/service-section-image.mjs` is a reusable two-step batch tool for adding an inline image
under a specific `contentSections[]` heading of a SERVICE page:

- `generate --index=N --out=/tmp/x.webp` — calls the configured OpenAI image model, crops/optimizes
  to 1600x900 16:9 WebP (same policy as the production hero-image pipeline), and writes locally.
  Nothing touches the DB or storage yet.
- `place --index=N --file=/tmp/x.webp` — recompresses to the admin-configured KB ceiling if needed,
  uploads to permanent object storage under `ai-images/service/{slug}/section-images/{seo-filename}.webp`,
  and writes the image into `content.body.contentSections[].image` for the row whose heading matches
  exactly. If the heading isn't found, the upload is kept permanently and reported — never deleted.

New batches are added as new `SPECS` entries (slug/heading/alt/prompt) at the bottom of the file
rather than a new script — the generate/place split exists specifically so a human/agent can visually
reject a generated frame (visible text, logos, readable signage, or a plate/plate-shaped dark
rectangle) before it is ever uploaded or attached. Rejects are just re-runs of `generate` with a new
`--out` path; nothing is written until `place` runs on an accepted file.

**Why:** earlier batches for the 14 already-illustrated service pages used this exact tool; keeping
one script with growing SPECS avoids re-deriving the SEO filename/compression/storage/DB-write logic
each time, and preserves a visual-review gate before anything goes live.

**How to apply:** when asked to add more service-page inline images, read this script first, append
new SPECS entries, then generate→inspect→(regenerate if it shows a plate/text/logo)→place per image.
