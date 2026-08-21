/**
 * Next.js middleware
 *
 * Responsibilities:
 * 1. Admin auth  — protects /admin/* (except login + logout endpoints)
 * 2. Locale pref — reads/writes ivt_lang_pref cookie so the user's
 *    last-chosen language persists across sessions.
 *    - URL locale always wins (visiting /en sets the cookie to "en")
 *    - "/" preserves a selected non-TR locale by redirecting to its
 *      locale-prefixed canonical home. Turkish remains prefix-free.
 *    - Never touches: /admin, /api, /_next, /data, static assets
 *
 * Locale sets used:
 *   NON_SOURCE_LOCALES  — all 8 non-TR registry codes (used for prefix
 *                         recognition so /es/foo is not treated as Turkish)
 *   RENDERABLE_LOCALES  — all 9 dictionary-backed registry locales
 *                         (used for cookie stamping and root redirect)
 *
 * Note: admin API routes live at /admin/api/* (not /api/admin/*) to avoid
 * the Replit proxy routing /api/* to the separate api-server artifact.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import type { SessionData } from '@/lib/auth/session';
import {
  NON_SOURCE_LOCALES,
  RENDERABLE_LOCALES,
} from '@/lib/i18n/locale-registry';

const COOKIE_NAME      = 'ivt_admin_session';
const LANG_PREF_COOKIE = 'ivt_lang_pref';

/**
 * All 8 non-TR locale prefixes from the registry.
 * Used for URL prefix detection only — lets the route layer (layout.tsx) handle
 * 404s for locales that don't have dictionaries yet.
 */
function isNonTrLang(s: string): boolean {
  return (NON_SOURCE_LOCALES as string[]).includes(s);
}

/**
 * Non-TR locales that have complete UI dictionaries.
 * All eight target locales may be stored in the lang preference cookie and
 * trigger a redirect from the Turkish root to their canonical route.
 */
function isRenderableNonTrLang(s: string): boolean {
  return s !== 'tr' && (RENDERABLE_LOCALES as string[]).includes(s);
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
    // Non-Turkish page visited.
    // Stamp the preference only for dictionary-backed locales. The registry
    // currently covers all eight non-source locales.
    if (isRenderableNonTrLang(urlLang)) {
      response.cookies.set(LANG_PREF_COOKIE, urlLang, cookieOpts);
    }
    return response;
  }

  // Turkish pages have no locale prefix. Preserve an existing non-TR
  // preference so links never silently reset the visitor's language.
  const pref = request.cookies.get(LANG_PREF_COOKIE)?.value;

  // The root is Turkish only for visitors without a selected target locale.
  // Once a visitor chooses English, German, Russian, Arabic, Spanish, French,
  // Italian, or Dutch, preserve that choice by using the canonical locale URL.
  if (pathname === '/' || pathname === '') {
    if (pref && isRenderableNonTrLang(pref)) {
      return NextResponse.redirect(new URL(`/${pref}`, request.url));
    }
    if (!pref) response.cookies.set(LANG_PREF_COOKIE, 'tr', cookieOpts);
    return response;
  }

  // Turkish sub-pages (e.g. /hizmetler, /blog, /araclar) do NOT carry an
  // explicit locale in the URL.  Stamp "tr" only on first contact so brand-new
  // visitors get the default Turkish experience without overwriting a preference
  // that was legitimately set by visiting /en, /de, etc.
  if (!pref) {
    response.cookies.set(LANG_PREF_COOKIE, 'tr', cookieOpts);
  }
  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
