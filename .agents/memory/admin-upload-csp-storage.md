---
name: Admin upload CSP allowlist
description: Why admin image uploads can fail even after the presigned-URL bug is fixed — CSP connect-src must allow the GCS storage domain.
---

The admin image upload flow (ImageUploadField → /admin/api/storage/request-url → browser PUTs directly to a GCS presigned URL) requires `https://storage.googleapis.com` in the `connect-src` CSP directive (next.config.ts `headers()`, both the dev/relaxed and production CSP blocks).

**Why:** The browser makes the PUT request itself (not the Next.js server), so any CSP `connect-src` restriction applies to it. Without the storage domain allowlisted, the browser silently blocks the PUT with a CSP violation — the network request never even reaches Google, and the failure looks identical to a signing/backend bug ("dosya yüklenemiyor" / upload never completes) even after the actual signing bug is fixed.

**How to apply:** When debugging "upload succeeds on the server but the file never lands" or "upload just hangs/fails silently in the browser," check the browser console for CSP violation messages before assuming the bug is in the presigned-URL generation code. Any future change to the object storage provider/domain must be mirrored in this CSP directive.
