---
name: Locale switch cookie race — /api/locale route
description: Why LanguageSelector must POST before navigating, and the ResponseCookies.set() key-collision trap.
---

## The rule
**Never use `<Link>` for language switching when middleware reads a cookie to decide redirects.**  
Use a GET redirect endpoint that sets the cookie AND redirects atomically in a single response.

**Why:**  
Next.js middleware reads the cookie from the *incoming* request.  
`<Link>` navigates before the cookie update — middleware sees the stale cookie and redirects back.  
A two-step "POST cookie then navigate" approach still has a race: the navigation can fire before Set-Cookie commits.  
The atomic `GET /api/locale/switch?locale=tr&next=/` response sends Set-Cookie **and** Location in the same headers — the destination page always arrives with the updated cookie already in the jar.

## Atomic endpoint pattern
`GET /api/locale/switch?locale=<lang>&next=<path>` → 302 redirect  
LanguageSelector: `window.location.assign('/api/locale/switch?' + new URLSearchParams({locale, next}))` — no fetch, no await.

## ResponseCookies.set() key-collision trap
`response.cookies.set(name, ...)` uses the cookie **name** as a unique key in a Map.  
Calling it a second time for the same name (even with a different `path`) **replaces** the first entry.

```ts
// ❌ WRONG — legacy expiry loop overwrites the main cookie
response.cookies.set('ivt_lang_pref', locale, { path: '/' });
for (const p of legacyPaths) {
  response.cookies.set('ivt_lang_pref', '', { path: p, maxAge: 0 }); // last write wins!
}

// ✅ CORRECT — use headers.append() for extras to avoid the key collision
response.cookies.set('ivt_lang_pref', locale, { path: '/', maxAge: 31536000, sameSite: 'lax' });
for (const p of legacyPaths) {
  response.headers.append('Set-Cookie', `ivt_lang_pref=; Path=${p}; Max-Age=0; SameSite=lax`);
}
```

## How to apply
Any time a Next.js route needs to set one authoritative cookie **and** expire several same-name cookies at different paths, use `response.cookies.set()` for the main one and `response.headers.append('Set-Cookie', rawString)` for the extras.

## Route location
`artifacts/istanbul-vip-transfer/app/api/locale/route.ts`  
Accepts POST `{ locale: 'tr'|'en'|'de'|'ru'|'ar' }`, sets `ivt_lang_pref` at `path=/`, expires five legacy sub-path variants.

## LanguageSelector pattern
`components/LanguageSelector.tsx` — dropdown items are now `<button>` elements (not `<Link>`).  
Click handler: `fetch('/api/locale', {method:'POST',...})` → await OK → `window.location.assign(localePath(pathname, targetLang))`.  
Shows a `pending` state (cursor:wait, disabled) until the navigation fires.
