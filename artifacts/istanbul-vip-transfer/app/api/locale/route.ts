/**
 * POST /api/locale
 *
 * Sets the ivt_lang_pref cookie server-side so the middleware sees the
 * updated preference before the next navigation lands.
 *
 * The LanguageSelector calls this first, then navigates with
 * window.location.assign() so that server components are fully re-rendered
 * with the new locale rather than potentially serving stale cached content.
 *
 * Implementation note:
 *   ResponseCookies.set() keys by cookie *name* only, so calling it multiple
 *   times for the same name replaces the previous entry.  We therefore use
 *   response.headers.append('Set-Cookie', …) for every extra header and keep
 *   response.cookies.set() only for the one authoritative cookie.
 */
import { NextRequest, NextResponse } from 'next/server';

const LANG_PREF_COOKIE = 'ivt_lang_pref';
const VALID_LANGS = ['tr', 'en', 'de', 'ru', 'ar'] as const;
type ValidLang = typeof VALID_LANGS[number];

function isValidLang(s: unknown): s is ValidLang {
  return typeof s === 'string' && (VALID_LANGS as readonly string[]).includes(s);
}

// Known sub-paths on which legacy cookies may have been set incorrectly;
// we send Max-Age=0 to expire them.
const LEGACY_COOKIE_PATHS = ['/en', '/de', '/ru', '/ar', '/tr'];

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const locale = (body as Record<string, unknown>)?.locale;
  if (!isValidLang(locale)) {
    return NextResponse.json(
      { error: 'locale must be one of: tr, en, de, ru, ar' },
      { status: 400 },
    );
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const secure       = isProduction ? '; Secure' : '';
  const response     = NextResponse.json({ ok: true, locale });

  // ── Authoritative cookie at path=/ ──────────────────────────────────────────
  // Use response.cookies.set() (not headers.append) so Next.js tracks it properly.
  response.cookies.set(LANG_PREF_COOKIE, locale, {
    path:     '/',
    maxAge:   60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
    secure:   isProduction,
    httpOnly: false,
  });

  // ── Expire legacy cookies that may have been set with wrong sub-paths ────────
  // We deliberately use headers.append() here so we never overwrite the main
  // cookie above (ResponseCookies.set() uses name as a unique key and would
  // replace the earlier entry).
  for (const legacyPath of LEGACY_COOKIE_PATHS) {
    response.headers.append(
      'Set-Cookie',
      `${LANG_PREF_COOKIE}=; Path=${legacyPath}; Max-Age=0; SameSite=lax${secure}`,
    );
  }

  return response;
}
