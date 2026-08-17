---
name: Web vitals routing
description: Web vitals beacon must go to /data/vitals, not /api/vitals — the /api prefix is routed to the api-server artifact.
---

## Rule
The Next.js web app's API routes under `/api/*` are **shadowed** by the separate `api-server` artifact in workspace routing. Any Next.js route at `app/api/...` will receive 404 from the api-server instead.

**Why:** The Replit artifact routing table sends all `/api/*` requests to the api-server (port 8080). The Next.js app's own `app/api/` routes are unreachable from the browser.

## Current state
- `WebVitalsReporter.tsx` sends beacons to `/data/vitals` ✅
- Route lives at `app/data/vitals/route.ts` ✅
- The old `app/api/vitals/route.ts` still exists but is unreachable from the browser

## How to apply
For any NEW Next.js API route that the browser must reach, always use the `/data/` prefix (`app/data/...`), never `/api/`. Reserve `app/api/` only for routes that can tolerate being handled by the api-server or are unused.
