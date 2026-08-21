/**
 * iron-session configuration and helpers.
 * Session cookie: httpOnly, sameSite=lax, 8-hour TTL.
 */
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { adminUsers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  getCurrentAdminSessionStatus,
  type AdminRole,
} from './authorization';

export interface SessionData {
  adminId: string;
  email: string;
  role: string;
  name: string;
  isLoggedIn: boolean;
  /** Incremented on every password change to invalidate other active sessions. */
  sessionVersion: number;
}

export function getAdminSessionErrorStatus(error: unknown): 401 | 403 | 503 {
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? (error as { status?: unknown }).status
    : undefined;
  return status === 403 || status === 503 ? status : 401;
}

export function getAdminSessionErrorMessage(status: 401 | 403 | 503): string {
  if (status === 403) return 'Forbidden';
  if (status === 503) return 'Authentication service unavailable';
  return 'Unauthorized';
}

const COOKIE_NAME = 'ivt_admin_session';

function buildSessionOptions() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'AUTH_SECRET environment variable is not set or is too short (minimum 32 characters).\n' +
        'Generate one with: openssl rand -hex 32\n' +
        'Then add it to Replit Secrets as AUTH_SECRET.\n' +
        'See ADMIN_SETUP.md.',
    );
  }
  return {
    password: secret,
    cookieName: COOKIE_NAME,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    },
  };
}

/**
 * Attempt to build session options without throwing.
 * Returns null if AUTH_SECRET is missing/invalid.
 * Used in middleware where throwing is undesirable.
 */
export function tryBuildSessionOptions() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return null;
  return {
    password: secret,
    cookieName: COOKIE_NAME,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 8,
      path: '/',
    },
  };
}

/**
 * Get the current admin session in a Server Component or Route Handler.
 * Uses next/headers cookies() — must be called from a server context.
 */
export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, buildSessionOptions());
}

/**
 * Require an authenticated session.
 * Returns session data or throws a 401-style error.
 */
export async function requireAdminSession(): Promise<SessionData> {
  let session;
  try {
    session = await getSession();
  } catch {
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  }
  if (!session.isLoggedIn || !session.adminId) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  }

  let user;
  try {
    [user] = await db
      .select({
        id: adminUsers.id,
        email: adminUsers.email,
        name: adminUsers.name,
        role: adminUsers.role,
        active: adminUsers.active,
        sessionVersion: adminUsers.sessionVersion,
      })
      .from(adminUsers)
      .where(eq(adminUsers.id, session.adminId))
      .limit(1);
  } catch {
    throw Object.assign(new Error('Authentication service unavailable'), { status: 503 });
  }

  // The cookie is only an identifier. Current active status, role, and session
  // version always come from the database.
  const status = getCurrentAdminSessionStatus(session.sessionVersion, user);
  if (status) {
    throw Object.assign(new Error(status === 401 ? 'Unauthorized' : 'Forbidden'), { status });
  }

  return {
    adminId: user.id,
    email: user.email,
    role: user.role as AdminRole,
    name: user.name,
    isLoggedIn: true,
    sessionVersion: user.sessionVersion,
  };
}
