---
name: AI image SEO filenames and delivery checks
description: How to distinguish missing AI image objects from a stopped public storage route.
---

AI image references can all appear broken even when every database URL still matches an existing storage object, because first-party object URLs are delivered by a separate API service.

**Why:** A stopped API workflow makes every `/api/storage/objects/...` request fail at once. Renaming, regenerating, or deleting images in that state risks damaging valid content while leaving the real delivery outage unresolved.

**How to apply:** Before changing image records, compare direct object-storage availability with the first-party HTTP route. If storage returns the object but the route fails, restore the API service instead of changing data. Keep the build-time object availability warning for mapping regressions, and still run a browser HTTP/render check to catch runtime service outages.

For direct server-side uploads, `PRIVATE_OBJECT_DIR` may be a slash-prefixed object prefix rather than `bucket/prefix`. In that case the bucket must come from `DEFAULT_OBJECT_STORAGE_BUCKET_ID`; treating the first path segment as the bucket can make signing and upload appear successful while the public object route returns 404.

**Why:** A blog-image upload accepted bytes into the wrong storage location because the slash-prefixed form was parsed as a bucket name.

**How to apply:** Reuse the project uploader's `parsePrivateDir` behavior exactly, require public AI assets to use the allowlisted `.webp` layout, then invalidate the public blog cache and verify both the object URL and rendered HTML.