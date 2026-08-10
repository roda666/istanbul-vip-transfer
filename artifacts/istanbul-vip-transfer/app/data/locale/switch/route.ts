/**
 * GET /data/locale/switch?locale=<lang>&next=<path>
 *
 * Atomic locale-preference switch: sets the ivt_lang_pref cookie AND redirects
 * in a single response so there is no window where the browser navigates before
 * the cookie reaches the server.
 *
 * Route is under /data/ (not /api/) because the Replit workspace proxy routes
 * all /api/* requests to the separate api-server artifact; /data/* reaches
 * this Next.js application directly (same pattern as /data/service-types, etc.).
 *
 * Security:
 *   - `locale` must be one of: tr, en, de, ru, ar
 *   - `next`   must be a safe same-site relative path (starts with /, no host,
 *              no //, no backslashes, no external protocol)
 *   - Legacy cookies with wrong sub-paths are expired in the same response
 *
 * Redirect construction:
 *   We NEVER use request.url / request.nextUrl.origin / new URL(next, request.url)
 *   because in Replit's container the internal origin is 0.0.0.0:<PORT>, which
 *   is unreachable by the browser.  Instead the Location header carries only the
 *   validated relative path; the browser preserves its current origin automatically.
 */
import { NextRequest, NextResponse } from 'next/server';

import { getPublicLangCodes } from '@/lib/i18n/active-locales';

const LANG_PREF_COOKIE = 'ivt_lang_pref';

/** Legacy paths on which stale cookies may still exist — expire them. */
const LEGACY_COOKIE_PATHS = ['/en', '/de', '/ru', '/ar', '/tr'];

/**
 * Accepts only root-relative same-site paths such as "/", "/hizmetler",
 * "/#rezervasyon", "/de/hizmetler?foo=1".
 * Rejects: empty string, external URLs, protocol-relative ("//…"),
 *          backslashes, and any value that parses to a non-localhost host.
 */
function isSafePath(next: string): boolean {
  if (!next || !next.startsWith('/')) return false;
  if (next.startsWith('//'))          return false; // protocol-relative
  if (/\\/.test(next))               return false; // backslash
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
  const rawNext = searchParams.get('next') ?? '/';

  // Validate against the active + published locale set (single source of truth).
  const publicLangs = await getPublicLangCodes();
  if (!publicLangs.includes(locale)) {
    return NextResponse.json(
      { error: `locale must be one of: ${publicLangs.join(', ')}` },
      { status: 400 },
    );
  }

  // Fall back to "/" for any invalid next value rather than rejecting.
  const next = isSafePath(rawNext) ? rawNext : '/';

  const isProduction = process.env.NODE_ENV === 'production';
  const secure       = isProduction ? '; Secure' : '';

  // ── Build the response manually with a RELATIVE Location header ──────────
  // Never use new URL(next, request.url) — in Replit's container request.url
  // contains 0.0.0.0:<PORT> which is invalid from the browser's perspective.
  // A relative Location value (e.g. "/") is perfectly valid per RFC 7231 §7.1.2
  // and the browser resolves it against its own current origin.
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: next },
  });

  // ── Authoritative cookie at path=/ ────────────────────────────────────────
  // One call to cookies.set() so the name-keyed internal Map is not overwritten.
  response.cookies.set(LANG_PREF_COOKIE, locale, {
    path:     '/',
    maxAge:   60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
    secure:   isProduction,
    httpOnly: false,
  });

  // ── Expire legacy cookies (wrong paths) ───────────────────────────────────
  // Use headers.append() — not cookies.set() — to avoid overwriting the entry above.
  for (const legacyPath of LEGACY_COOKIE_PATHS) {
    response.headers.append(
      'Set-Cookie',
      `${LANG_PREF_COOKIE}=; Path=${legacyPath}; Max-Age=0; SameSite=lax${secure}`,
    );
  }

  return response;
}
