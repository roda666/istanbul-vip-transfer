/**
 * Next.js middleware — protects /admin/* routes (UI + API).
 *
 * Strategy:
 * - /admin/login is always accessible (public)
 * - /admin/api/login and /admin/api/logout are always accessible
 * - All other /admin/* routes require a valid session
 * - If AUTH_SECRET is not configured, all protected routes return 503/redirect
 *
 * Note: admin API routes live at /admin/api/* (not /api/admin/*) to avoid
 * the Replit proxy routing /api/* to the separate api-server artifact.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import type { SessionData } from '@/lib/auth/session';

const COOKIE_NAME = 'ivt_admin_session';

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

// Paths within /admin that don't require auth
const PUBLIC_PATHS = ['/admin/login', '/admin/api/login', '/admin/api/logout'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/admin')) return NextResponse.next();
  if (isPublicPath(pathname)) return NextResponse.next();

  const options = tryGetOptions();

  // AUTH_SECRET not configured
  if (!options) {
    if (pathname.startsWith('/admin/api/')) {
      return NextResponse.json(
        { error: 'Server misconfigured: AUTH_SECRET is not set. See ADMIN_SETUP.md.' },
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
      // Prevent open redirect: always redirect to /admin/login
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

export const config = {
  matcher: ['/admin/:path*'],
};
