---
name: AI image SEO filenames and delivery checks
description: How to distinguish missing AI image objects from a stopped public storage route.
---

AI image references can all appear broken even when every database URL still matches an existing storage object, because first-party object URLs are delivered by a separate API service.

**Why:** A stopped API workflow makes every `/api/storage/objects/...` request fail at once. Renaming, regenerating, or deleting images in that state risks damaging valid content while leaving the real delivery outage unresolved.

**How to apply:** Before changing image records, compare direct object-storage availability with the first-party HTTP route. If storage returns the object but the route fails, restore the API service instead of changing data. Keep the build-time object availability warning for mapping regressions, and still run a browser HTTP/render check to catch runtime service outages.