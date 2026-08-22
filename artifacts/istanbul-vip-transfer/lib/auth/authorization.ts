/**
 * Central, deny-by-default authorization policy for the admin surface.
 *
 * This module intentionally has no database or Next.js dependencies so the
 * policy can be used by middleware, route handlers, pages, and tests.
 */

export const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'CHAT_STAFF'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  'ADMIN_ACCESS',
  'DASHBOARD_READ',
  'CONTENT_READ',
  'CONTENT_WRITE',
  'CONTENT_PUBLISH',
  'CONTENT_DELETE',
  'AI_USE',
  'TRANSLATIONS_MANAGE',
  'FLEET_MANAGE',
  'RESERVATIONS_READ',
  'RESERVATIONS_MANAGE',
  'NEWSLETTER_READ',
  'NEWSLETTER_MANAGE',
  'CHAT_MANAGE',
  'ANALYTICS_READ',
  'SITE_SETTINGS_MANAGE',
  'SECURITY_SETTINGS_MANAGE',
  'INTEGRATIONS_MANAGE',
  'MEDIA_MANAGE',
  'STAFF_MANAGE',
  'AUDIT_READ',
  'DATABASE_BACKUP',
  'ACCOUNT_SELF_MANAGE',
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export type AdminAuthFailure = 'unauthenticated' | 'forbidden' | 'unavailable';

const ALL_PERMISSIONS = new Set<AdminPermission>(ADMIN_PERMISSIONS);

/** The only source of truth for role capabilities. Unknown roles get nothing. */
export const ROLE_PERMISSIONS: Readonly<Record<AdminRole, ReadonlySet<AdminPermission>>> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  ADMIN: new Set([
    'ADMIN_ACCESS', 'DASHBOARD_READ', 'CONTENT_READ', 'CONTENT_WRITE',
    'CONTENT_PUBLISH', 'CONTENT_DELETE', 'AI_USE', 'TRANSLATIONS_MANAGE',
    'FLEET_MANAGE', 'RESERVATIONS_READ', 'RESERVATIONS_MANAGE',
    'NEWSLETTER_READ', 'NEWSLETTER_MANAGE', 'CHAT_MANAGE', 'ANALYTICS_READ',
    'SITE_SETTINGS_MANAGE', 'MEDIA_MANAGE', 'AUDIT_READ', 'ACCOUNT_SELF_MANAGE',
  ]),
  EDITOR: new Set([
    'ADMIN_ACCESS', 'DASHBOARD_READ', 'CONTENT_READ', 'CONTENT_WRITE',
    'AI_USE', 'TRANSLATIONS_MANAGE', 'ACCOUNT_SELF_MANAGE',
  ]),
  CHAT_STAFF: new Set(['CHAT_MANAGE', 'ACCOUNT_SELF_MANAGE']),
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value);
}

export function hasAdminPermission(role: unknown, permission: AdminPermission): boolean {
  return isAdminRole(role) && ROLE_PERMISSIONS[role].has(permission);
}

export type CurrentAdminRecord = {
  active: boolean;
  role: unknown;
  sessionVersion: number;
} | null | undefined;

/**
 * Shared session outcome used after the cookie has been decoded. This keeps
 * inactive, deleted, stale and malformed-role decisions identical everywhere.
 */
export function getCurrentAdminSessionStatus(
  cookieSessionVersion: number | undefined,
  currentUser: CurrentAdminRecord,
): 401 | 403 | null {
  if (!currentUser || !currentUser.active || currentUser.sessionVersion !== (cookieSessionVersion ?? 1)) {
    return 401;
  }
  return isAdminRole(currentUser.role) ? null : 403;
}

export function getAdminAuthFailureStatus(failure: AdminAuthFailure): 401 | 403 | 503 {
  if (failure === 'forbidden') return 403;
  if (failure === 'unavailable') return 503;
  return 401;
}

export function isStateChangingMethod(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

function readOrWrite(method: string, read: AdminPermission, write: AdminPermission): AdminPermission {
  return isStateChangingMethod(method) ? write : read;
}

function contentPermission(pathname: string, method: string): AdminPermission {
  if (pathname.includes('/publish') || pathname.includes('/bulk-publish')) return 'CONTENT_PUBLISH';
  if (method.toUpperCase() === 'DELETE') return 'CONTENT_DELETE';
  return readOrWrite(method, 'CONTENT_READ', 'CONTENT_WRITE');
}

function studioPermission(pathname: string, method: string): AdminPermission {
  const isPublishOperation =
    pathname.includes('/approve') ||
    pathname.includes('/publish') ||
    (pathname.includes('/schedule') && isStateChangingMethod(method));

  if (isPublishOperation) return 'CONTENT_PUBLISH';
  if (method.toUpperCase() === 'DELETE') return 'CONTENT_DELETE';
  return 'AI_USE';
}

/**
 * Returns the permission required by a protected API route. `undefined`
 * deliberately means “unmapped and denied”, never “allowed”.
 */
export function getAdminApiPermission(pathname: string, method: string): AdminPermission | undefined {
  if (pathname === '/admin/api/logout' || pathname === '/admin/api/change-password') {
    return 'ACCOUNT_SELF_MANAGE';
  }
  if (pathname.startsWith('/admin/api/database-backup')) return 'DATABASE_BACKUP';
  if (pathname.startsWith('/admin/api/staff')) return 'STAFF_MANAGE';
  if (pathname.startsWith('/admin/api/email-settings')) return 'SECURITY_SETTINGS_MANAGE';
  if (pathname.startsWith('/admin/api/social-platforms') ||
      pathname.startsWith('/admin/api/google-ads') ||
      pathname.startsWith('/admin/api/gsc')) return 'INTEGRATIONS_MANAGE';
  if (pathname.startsWith('/admin/api/storage')) return 'MEDIA_MANAGE';
  // This endpoint issues a signed storage upload capability, not a CMS edit.
  // Keep it ahead of the broader homepage content prefix below.
  if (pathname === '/admin/api/homepage/media') return 'MEDIA_MANAGE';

  if (pathname.startsWith('/admin/api/requests')) return readOrWrite(method, 'RESERVATIONS_READ', 'RESERVATIONS_MANAGE');
  if (pathname.startsWith('/admin/api/newsletter')) return readOrWrite(method, 'NEWSLETTER_READ', 'NEWSLETTER_MANAGE');
  if (pathname.startsWith('/admin/api/chatbot/settings')) return 'SITE_SETTINGS_MANAGE';
  if (pathname.startsWith('/admin/api/chatbot')) return 'CHAT_MANAGE';
  if (pathname.startsWith('/admin/api/analytics')) return 'ANALYTICS_READ';

  if (pathname.startsWith('/admin/api/vehicles') ||
      pathname.startsWith('/admin/api/locations') ||
      pathname.startsWith('/admin/api/transfer-routes') ||
      pathname.startsWith('/admin/api/price-rules') ||
      pathname.startsWith('/admin/api/price-calculator')) return 'FLEET_MANAGE';
  if (pathname.startsWith('/admin/api/reservation-settings') ||
      pathname.startsWith('/admin/api/custom-fields') ||
      pathname.startsWith('/admin/api/service-types')) return 'SITE_SETTINGS_MANAGE';
  if (pathname.startsWith('/admin/api/settings') || pathname.startsWith('/admin/api/languages')) {
    return 'SECURITY_SETTINGS_MANAGE';
  }

  if (pathname.startsWith('/admin/api/translations')) return 'TRANSLATIONS_MANAGE';
  if (pathname.startsWith('/admin/api/studio')) return studioPermission(pathname, method);
  if (pathname.startsWith('/admin/api/ai-content')) return 'AI_USE';
  if (pathname.startsWith('/admin/api/ai-writing')) return 'AI_USE';

  if (pathname.startsWith('/admin/api/content') ||
      pathname.startsWith('/admin/api/blog') ||
      pathname.startsWith('/admin/api/categories') ||
      pathname.startsWith('/admin/api/faqs') ||
      pathname.startsWith('/admin/api/nav') ||
      pathname.startsWith('/admin/api/homepage') ||
      pathname.startsWith('/admin/api/service-pages') ||
      pathname.startsWith('/admin/api/topic-clusters') ||
      pathname.startsWith('/admin/api/ai-suggestions')) {
    return contentPermission(pathname, method);
  }
  return undefined;
}

/** Public recovery/login endpoints and the separately secret-protected cron are not admin-session APIs. */
export function isPublicAdminApi(pathname: string): boolean {
  return pathname === '/admin/api/login' || pathname.startsWith('/admin/api/auth/reset-password');
}

export function isCronAdminApi(pathname: string): boolean {
  return pathname === '/admin/api/cron/weekly-draft' || pathname === '/admin/api/cron/draft-cadence';
}

/**
 * Page permissions are explicit too. The access-denied route is available to a
 * valid session of any role so a failed authorization cannot redirect in a loop.
 */
export function getAdminPagePermission(pathname: string): AdminPermission | undefined {
  if (pathname === '/admin/erisim-reddedildi' || pathname.startsWith('/admin/hesabim')) {
    return 'ACCOUNT_SELF_MANAGE';
  }
  if (pathname.startsWith('/admin/sohbet') || pathname.startsWith('/admin/chatbot-bilgi-bankasi')) {
    return 'CHAT_MANAGE';
  }
  if (pathname.startsWith('/admin/personel')) return 'STAFF_MANAGE';
  if (pathname.startsWith('/admin/e-posta-ayarlari') || pathname.startsWith('/admin/diller')) {
    return 'SECURITY_SETTINGS_MANAGE';
  }
  if (pathname.startsWith('/admin/veritabani-yedegi')) return 'DATABASE_BACKUP';
  if (pathname.startsWith('/admin/ayarlar') || pathname.startsWith('/admin/rezervasyon-ayarlari')) {
    return 'SITE_SETTINGS_MANAGE';
  }
  if (pathname.startsWith('/admin/talepler')) return 'RESERVATIONS_READ';
  if (pathname.startsWith('/admin/bulten-aboneleri')) return 'NEWSLETTER_READ';
  if (pathname.startsWith('/admin/araclar') || pathname.startsWith('/admin/transfer-rotalari') || pathname.startsWith('/admin/fiyat-kurallari')) return 'FLEET_MANAGE';
  if (pathname.startsWith('/admin/ai-studio') || pathname.startsWith('/admin/ai-oneriler')) return 'AI_USE';
  if (pathname.startsWith('/admin/ceviriler') || pathname.startsWith('/admin/dil-ve-ceviri')) return 'TRANSLATIONS_MANAGE';
  if (pathname.startsWith('/admin/gecmis')) return 'AUDIT_READ';
  if (pathname.startsWith('/admin/istatistikler')) return 'ANALYTICS_READ';
  if (pathname === '/admin' || pathname === '/admin/dashboard') return 'DASHBOARD_READ';
  if (pathname.startsWith('/admin/blog') ||
      pathname.startsWith('/admin/hizmetler') ||
      pathname.startsWith('/admin/sayfalar') ||
      pathname.startsWith('/admin/kategoriler') ||
      pathname.startsWith('/admin/menu') ||
      pathname.startsWith('/admin/sss')) return 'CONTENT_READ';
  return undefined;
}

/**
 * Origin checks supplement the existing httpOnly, Secure-in-production and
 * SameSite=Lax session cookie. Cookie-authenticated mutations must have an
 * exact trusted Origin. Non-browser automation needs a separate auth path
 * (for example, the dedicated cron endpoint).
 */
export function hasValidAdminMutationOrigin(input: {
  method: string;
  origin: string | null;
  secFetchSite: string | null;
  expectedOrigins: readonly string[];
}): boolean {
  if (!isStateChangingMethod(input.method)) return true;
  if (input.secFetchSite === 'cross-site') return false;
  return !!input.origin && input.expectedOrigins.includes(input.origin);
}