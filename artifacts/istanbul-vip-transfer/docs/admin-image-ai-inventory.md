# Admin image field inventory

This is the allowlisted inventory for admin image inputs. Image generation is
never a generic table/column write: the studio route accepts only the target
and field contracts below, validates the record identity, stores WebP bytes in
private object storage, and revalidates the owning public routes.

| Admin surface | Field | Storage/input | AI support | Contract / reason |
|---|---|---|---|---|
| Homepage | Hero `sections.hero.imagePath` + `imageAlt` | `content.body` JSON, slug `ana-sayfa` | Yes | `HOMEPAGE` + `hero_image`; source row only |
| Homepage | Social/OG `sections.seo.ogImage` + `ogImageAlt` | `content.body` JSON, slug `ana-sayfa` | Yes | `HOMEPAGE` + `og_image`; source row only |
| Homepage | Featured/services/vehicles/trust/reviews/reservation/contact/footer | Text/config only in current schema | N/A | No image field exists to attach safely |
| Pages / Content | `content.heroImage` + `heroImageAlt` | `content` row | Yes | `PAGE` + `hero_image`; only rows with `contentType=PAGE` |
| Blog | Hero/cover `content.heroImage` + alt | `content` row | Yes | `BLOG_POST` + `hero_image` |
| Blog | Body inline image | Markdown in `content.body` | Yes | `BLOG_POST` + `body`; append-only markdown contract |
| Blog | `content.ogImage` | `content` row | Yes | `BLOG_POST` + `og_image`; previously UI-used hero placement, now typed correctly |
| Service editor | Hero `content.heroImage` + alt | `content` row | Yes | `SERVICE` + `hero` |
| Service editor | `content.ogImage` | `content` row | Yes | `SERVICE` + `og_image`; previously UI-used hero placement, now typed correctly |
| Service editor | Structured body inline image | Service body JSON | Yes | `SERVICE` + `body`; validated structured-body append contract |
| Vehicle editor | Cover `vehicles.coverImage` + alt | `vehicles` row | Yes | `VEHICLE` + `hero` |
| Vehicle editor | Gallery item | `vehicles.gallery` JSON | Yes | `VEHICLE` + `body`; append-only gallery item contract |
| Vehicle editor | OG image | `vehicles.ogImage` | Yes | `VEHICLE` + `og_image`; separate from cover and gallery |
| Transfer routes | Route image + alt | Dedicated transfer-route image API | Yes (existing) | Existing route-specific `generate` action uses the central OpenAI generator and strict route image storage validation; retained because it also handles source URL/import and route slug metadata |
| Categories | No image input found | — | N/A | rg audit found no file input, ImageUploadField, image URL, or image column in the admin form |
| Locations | No standalone image input found | — | N/A | rg audit found no file input, ImageUploadField, image URL, or image column |
| Optional services / FAQ / menu / staff / competitors | No image input found | — | N/A | rg audit found no file input, ImageUploadField, image URL, or image column in current forms |

## Homepage source contract

`PAGE` is accepted only with an existing `content` row whose `contentType` is
`PAGE`, and only `hero_image` can be changed. `BLOG_POST` and `SERVICE` use
typed `hero_image`, `og_image`, and (Blog/Service where present) `body`
contracts. `VEHICLE` uses typed `cover_image`, `og_image`, and `gallery`.
`HOMEPAGE` is accepted only with an existing `content` row whose slug is
`ana-sayfa`. `homepageField` is required and is one of `hero_image` or
`og_image`; the route mutates only the corresponding allowlisted nested keys.
The route rejects a homepage request without a field and rejects that field for
all other targets. All homepage locale tags and `/` are revalidated after a
successful attachment.

## Verification

The unit contract test checks the target union, homepage field allowlist,
storage folder, and homepage editor wiring. Real-provider browser verification
is intentionally run by the parent agent because it consumes OpenAI credits:

```bash
pnpm exec playwright test tests/studio-image-homepage.spec.ts
```
