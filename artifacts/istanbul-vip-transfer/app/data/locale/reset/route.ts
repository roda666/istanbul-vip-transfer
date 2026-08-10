/**
 * GET /data/locale/reset — reset the language preference cookie to Turkish
 * and redirect to the root page.
 *
 * Used when a visitor lands on a locale that is no longer publicly active
 * (e.g. an admin disabled a launched language while the visitor still has a
 * stale `ivt_lang_pref` cookie). The static edge middleware would otherwise
 * keep bouncing `/` → `/{lang}` based on the stale cookie while the layout
 * bounces `/{lang}` → `/`, producing a redirect loop. Clearing the cookie
 * here breaks that loop safely.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const LANG_PREF_COOKIE = 'ivt_lang_pref';

export async function GET() {
  const res = new NextResponse(null, {
    status: 303,
    headers: { Location: '/' },
  });
  res.cookies.set(LANG_PREF_COOKIE, 'tr', {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
