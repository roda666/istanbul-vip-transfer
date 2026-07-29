/**
 * Next.js middleware
 *
 * Responsibilities:
 * 1. Admin auth  — protects /admin/* (except login + logout endpoints)
 * 2. Locale pref — reads/writes ivt_lang_pref cookie so the user's
 *    last-chosen language persists across sessions.
 *    - URL locale always wins (visiting /en sets the cookie to "en")
 *    - Visiting / when the cookie says e.g. "de" redirects to /de
 *    - Never redirects: /admin, /api, /_next, /data, static assets
 *
 * Note: admin API routes live at /admin/api/* (not /api/admin/*) to avoid
 * the Replit proxy routing /api/* to the separate api-server artifact.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import type { SessionData } from '@/lib/auth/session';

const COOKIE_NAME      = 'ivt_admin_session';
const LANG_PREF_COOKIE = 'ivt_lang_pref';

/** Languages that live at a /{lang} prefix (Turkish is at root). */
const NON_TR_LANGS = ['en', 'de', 'ru', 'ar'] as const;
type NonTrLang = typeof NON_TR_LANGS[number];

function isNonTrLang(s: string): s is NonTrLang {
  return (NON_TR_LANGS as readonly string[]).includes(s);
}

function tryGetOptions() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return null;
  return {
    password: secret,
    cookieName: COOKIE_NAME,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
    },
  };
}

const PUBLIC_PATHS = ['/admin/login', '/admin/api/login', '/admin/api/logout'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/** Paths that should never be touched by locale logic. */
function isExemptFromLocale(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/data') ||
    // Static files: have an extension
    /\.[a-z0-9]+$/i.test(pathname)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Admin auth ──────────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (isPublicPath(pathname)) return NextResponse.next();

    const options = tryGetOptions();

    if (!options) {
      if (pathname.startsWith('/admin/api/')) {
        return NextResponse.json(
          { error: 'Server misconfigured: AUTH_SECRET is not set.' },
          { status: 503 },
        );
      }
      return NextResponse.redirect(new URL('/admin/login?error=misconfigured', request.url));
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = await getIronSession<SessionData>(request.cookies as any, options);

      if (!session.isLoggedIn || !session.adminId) {
        if (pathname.startsWith('/admin/api/')) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/admin/login', request.url));
      }
    } catch {
      if (pathname.startsWith('/admin/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    return NextResponse.next();
  }

  // ── Locale preference ───────────────────────────────────────────────────────
  if (isExemptFromLocale(pathname)) return NextResponse.next();

  // Detect whether this request is for a lang-prefixed page, e.g. /en, /en/blog
  const firstSegment = pathname.split('/')[1] ?? '';
  const urlLang: string | null = isNonTrLang(firstSegment) ? firstSegment : null;

  const response = NextResponse.next();
  const cookieOpts = {
    path:     '/',
    maxAge:   60 * 60 * 24 * 365,  // 1 year
    sameSite: 'lax' as const,
    secure:   process.env.NODE_ENV === 'production',
  };

  if (urlLang) {
    // Non-Turkish page visited → stamp/update the cookie with the URL lang
    response.cookies.set(LANG_PREF_COOKIE, urlLang, cookieOpts);
    return response;
  }

  // Turkish pages (no lang prefix, e.g. /, /blog, /hizmetler, /vip-transfer …)
  // URL locale wins: any visit to a Turkish page overrides the preference to "tr".
  // Exception: only redirect on the exact root "/" so that clicking a Turkish
  // content link from a non-Turkish session doesn't bounce the user back.
  const pref = request.cookies.get(LANG_PREF_COOKIE)?.value;

  if ((pathname === '/' || pathname === '') && pref && isNonTrLang(pref)) {
    // Fresh root visit with a non-TR cookie → send them to their preferred locale
    const target = new URL(`/${pref}`, request.url);
    const redirect = NextResponse.redirect(target);
    redirect.cookies.set(LANG_PREF_COOKIE, pref, cookieOpts);
    return redirect;
  }

  // Stamp (or refresh) the "tr" preference for any Turkish page visit
  response.cookies.set(LANG_PREF_COOKIE, 'tr', cookieOpts);
  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
