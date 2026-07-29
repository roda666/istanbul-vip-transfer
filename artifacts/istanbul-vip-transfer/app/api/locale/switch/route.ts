/**
 * GET /api/locale/switch?locale=<lang>&next=<path>
 *
 * Atomic locale-preference switch: sets the cookie AND redirects in a single
 * response so there is no window where the browser navigates before the
 * cookie reaches the server.
 *
 * The previous two-step "POST cookie → then navigate" approach had a race:
 * if the browser completed the navigation before the Set-Cookie header was
 * flushed and committed, middleware read the stale cookie and redirected back
 * to the old locale.  A single redirect response eliminates that race.
 *
 * Security:
 *   - `locale` must be one of: tr, en, de, ru, ar
 *   - `next`   must be a safe same-site relative path (starts with /, no host)
 *   - Legacy cookies with wrong sub-paths are expired in the same response
 */
import { NextRequest, NextResponse } from 'next/server';

// ── Shared constants ────────────────────────────────────────────────────────
const LANG_PREF_COOKIE = 'ivt_lang_pref';
const VALID_LANGS = ['tr', 'en', 'de', 'ru', 'ar'] as const;
type ValidLang = typeof VALID_LANGS[number];

/** Legacy paths on which stale cookies may still exist — expire them. */
const LEGACY_COOKIE_PATHS = ['/en', '/de', '/ru', '/ar', '/tr'];

function isValidLang(s: unknown): s is ValidLang {
  return typeof s === 'string' && (VALID_LANGS as readonly string[]).includes(s);
}

/**
 * Accepts only root-relative same-site paths such as "/", "/hizmetler",
 * "/#rezervasyon", "/de/hizmetler?foo=1".
 * Rejects: empty, external URLs, protocol-relative ("//…").
 */
function isSafePath(next: string): boolean {
  if (!next || !next.startsWith('/')) return false;
  if (next.startsWith('//'))          return false;   // protocol-relative
  // Reject anything that parses as a foreign origin
  try {
    const u = new URL(next, 'http://localhost');
    return u.host === 'localhost';
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const locale = searchParams.get('locale') ?? '';
  const next   = searchParams.get('next')   ?? '/';

  if (!isValidLang(locale)) {
    return NextResponse.json(
      { error: 'locale must be one of: tr, en, de, ru, ar' },
      { status: 400 },
    );
  }
  if (!isSafePath(next)) {
    return NextResponse.json(
      { error: 'next must be a safe same-site relative path' },
      { status: 400 },
    );
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const secure       = isProduction ? '; Secure' : '';

  // Build the redirect target URL (preserves path + query + hash)
  const target   = new URL(next, request.url);
  const redirect = NextResponse.redirect(target, { status: 302 });

  // ── Authoritative cookie at path=/ ────────────────────────────────────────
  // Use redirect.cookies.set() — only ONE call so the name-keyed Map is not
  // overwritten by subsequent sets.
  redirect.cookies.set(LANG_PREF_COOKIE, locale, {
    path:     '/',
    maxAge:   60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
    secure:   isProduction,
    httpOnly: false,
  });

  // ── Expire legacy cookies (different paths) ────────────────────────────────
  // Use headers.append() so the above cookies.set() entry is not overwritten.
  for (const legacyPath of LEGACY_COOKIE_PATHS) {
    redirect.headers.append(
      'Set-Cookie',
      `${LANG_PREF_COOKIE}=; Path=${legacyPath}; Max-Age=0; SameSite=lax${secure}`,
    );
  }

  return redirect;
}
