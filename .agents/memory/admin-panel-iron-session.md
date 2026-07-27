---
name: Admin panel — iron-session + Next.js type quirks
description: Known type incompatibilities and fixes when using iron-session v8 with Next.js 15 App Router middleware and route handlers.
---

## iron-session v8 + Next.js 15: RequestCookies type mismatch

`getIronSession(request.cookies, options)` fails TypeScript build with:
> Argument of type 'RequestCookies' is not assignable to parameter of type 'CookieStore'

**Why:** `request.cookies` in Next.js middleware is `RequestCookies` whose `.set()` signature differs from iron-session's `CookieStore`.

**How to apply:**
- In middleware: cast to `any` — `getIronSession<T>(request.cookies as any, options)`
- In Route Handlers and Server Components: use `await cookies()` from `next/headers` — fully compatible with `CookieStore`
- Never expose a `getSessionFromRequest(req)` helper that passes `request.cookies` directly; delete or avoid it

## Admin protected layout must be force-dynamic

All pages inside `app/admin/(protected)/` must NOT be statically prerendered.

**Why:** Next.js tries to SSG any page that doesn't call a dynamic function directly. The protected layout calls `await cookies()` (dynamic), but that doesn't automatically force child pages to be dynamic. During static prerender, React serialization trips on event handlers or client boundaries.

**How to apply:**
Add to `app/admin/(protected)/layout.tsx`:
```ts
export const dynamic = 'force-dynamic';
```
This single export propagates to all child pages in the route group.

## Content workflow: status transition enforcement

The `validateStatusTransition()` helper in `lib/workflow.ts` exists but must be actively wired into API handlers — it is not automatic.

**Rules enforced in API:**
- POST `/api/admin/content`: status schema allows only `DRAFT | RESEARCH | REVIEW`
- PUT `/api/admin/content/[id]`: status schema allows `DRAFT | RESEARCH | REVIEW | SCHEDULED | ARCHIVED` (APPROVED/PUBLISHED blocked)
- SCHEDULED via PUT: requires `current.status === 'APPROVED'` AND `scheduledAt` present in payload
- APPROVED: only via POST `/api/admin/content/[id]` with `{ action: 'approve' }`
- PUBLISHED: only via POST `/api/admin/content/[id]` with `{ action: 'publish' }`, requires existing `approvedAt`/`approvedBy`
