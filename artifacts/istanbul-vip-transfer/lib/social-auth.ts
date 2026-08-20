import 'server-only';

import { requireAdminSession, type SessionData } from '@/lib/auth/session';

const SOCIAL_PLATFORM_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);

/**
 * Social account changes and external publishing are privileged operations.
 * A valid session alone is not sufficient because EDITOR and CHAT_STAFF
 * accounts may access other protected admin functionality.
 */
export async function requireSocialPlatformAdmin(): Promise<SessionData> {
  const session = await requireAdminSession();
  if (!SOCIAL_PLATFORM_ROLES.has(session.role)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  return session;
}

export function socialAuthErrorResponse(error: unknown) {
  const status = typeof error === 'object' && error && 'status' in error
    ? Number((error as { status?: number }).status)
    : 401;
  return { error: status === 403 ? 'Bu işlem için yönetici yetkisi gerekli.' : 'Unauthorized', status };
}