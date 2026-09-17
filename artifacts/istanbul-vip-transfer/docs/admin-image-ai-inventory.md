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
| Pages / Content | `content.heroImage` + `heroImageAlt` | `content` row | No for generic `PAGE` | Generic pages have no stable image attachment contract; arbitrary `PAGE` writes are intentionally rejected |
| Blog | Hero/cover `content.heroImage` + alt | `content` row | Yes | `BLOG_POST` + `hero`; inline body uses `BLOG_POST` + `body` |
| Blog | Body inline image | Markdown in `content.body` | Yes | `BLOG_POST` + `body`; append-only markdown contract |
| Service editor | Hero `content.heroImage` + alt | `content` row | Yes | `SERVICE` + `hero` |
| Service editor | Structured body inline image | Service body JSON | Yes | `SERVICE` + `body`; validated structured-body append contract |
| Vehicle editor | Cover `vehicles.coverImage` + alt | `vehicles` row | Yes | `VEHICLE` + `hero` |
| Vehicle editor | Gallery item | `vehicles.gallery` JSON | Yes | `VEHICLE` + `body`; append-only gallery item contract |
| Vehicle editor | OG image | `vehicles.ogImage` | Existing upload only | The shared field currently exposes the OG upload but the studio route has no separate safe OG mutation contract; not silently mapped to cover |
| Transfer routes | Route image + alt | Dedicated transfer-route image API | Yes (existing) | Existing route-specific `generate` action uses the central OpenAI generator and strict route image storage validation; retained because it also handles source URL/import and route slug metadata |
| Categories | No image input found | — | N/A | No image column/control in the admin form |
| Locations | No standalone image input found | — | N/A | Location management is configuration data without an image field |
| Optional services / FAQ / menu / staff / competitors | No image input found | — | N/A | No image field/control found in current admin forms |

## Homepage source contract

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
