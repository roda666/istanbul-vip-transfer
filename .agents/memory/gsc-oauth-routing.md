---
name: GSC OAuth routing fix
description: Why /api/auth/gsc routes don't work and where they were moved.
---

# GSC OAuth Routing Fix

## The Rule
Never put Next.js route handlers under `app/api/` in this project. They will never be reached.

**Why:** The `artifacts/api-server` artifact has `paths = ["/api"]` in its `artifact.toml`. The Replit router forwards **all** `/api/*` requests to the api-server (port 8080), bypassing Next.js entirely. Next.js `app/api/*` route files are dead code.

**How to apply:** Any Next.js API route must live under a prefix that the api-server does NOT own:
- ✅ `/admin/api/*` — safe, not owned by api-server
- ✅ `/data/*` — safe (established workaround, see reservation-location-system.md)
- ❌ `/api/*` — always hits api-server

## What Was Done
- Moved `app/api/auth/gsc/route.ts` → `app/admin/api/gsc/connect/route.ts`
- Moved `app/api/auth/gsc/callback/route.ts` → `app/admin/api/gsc/callback/route.ts`
- Updated settings page buttons from `/api/auth/gsc` → `/admin/api/gsc/connect`
- Updated setup instructions to show new callback URL
- Deleted old unreachable files

## Google Cloud Console
GSC OAuth callback URI, isteğin public HTTPS host’undan oluşturulur. Google exact-match ister; bu nedenle Cloud Console’da hem production callback hem de aktif Replit preview host’unun aynı `/admin/api/gsc/callback` yolu kayıtlı olmalıdır.

**Why:** Önizleme isteğinin geri dönüşü preview host’una yapılır; yalnızca production URI kayıtlıysa Google `redirect_uri_mismatch` döndürür. Buna karşılık internal `localhost` veya proxy URL’leri hiçbir zaman kayıt edilmemelidir.
