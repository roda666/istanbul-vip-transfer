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

/**
 * The grant vocabulary intentionally follows the labels used by the admin
 * menu.  A grant is section-scoped (rather than a collection of ad-hoc route
 * strings), so adding a route to an existing section cannot accidentally make
 * it public.
 */
export const ADMIN_GRANT_SECTIONS = [
  { key: 'dashboard', label: 'Dashboard', permissions: ['DASHBOARD_READ'] },
  { key: 'requests', label: 'Talepler', permissions: ['RESERVATIONS_READ', 'RESERVATIONS_MANAGE'] },
  { key: 'transfer_operations', label: 'Transfer Operasyonları', permissions: ['FLEET_MANAGE'] },
  { key: 'analytics', label: 'İstatistikler', permissions: ['ANALYTICS_READ'] },
  { key: 'reservation_settings', label: 'Rezervasyon Ayarları', permissions: ['SITE_SETTINGS_MANAGE'] },
  { key: 'chat', label: 'Canlı Sohbet', permissions: ['CHAT_MANAGE'] },
  { key: 'chatbot', label: 'Chatbot Bilgi Bankası', permissions: ['CHAT_MANAGE'] },
  { key: 'newsletter', label: 'Bülten Aboneleri', permissions: ['NEWSLETTER_READ', 'NEWSLETTER_MANAGE'] },
  { key: 'fleet_pricing', label: 'Araçlar ve Transferler', permissions: ['FLEET_MANAGE'] },
  { key: 'content', label: 'İçerik', permissions: ['CONTENT_READ', 'CONTENT_WRITE', 'CONTENT_PUBLISH', 'CONTENT_DELETE'] },
  { key: 'translations', label: 'Dil ve Çeviri', permissions: ['TRANSLATIONS_MANAGE'] },
  { key: 'ai_content', label: 'AI İçerik Merkezi', permissions: ['AI_USE'] },
  { key: 'site_navigation', label: 'Menü Yönetimi', permissions: ['CONTENT_READ', 'CONTENT_WRITE'] },
  { key: 'site_settings', label: 'Site Ayarları', permissions: ['SITE_SETTINGS_MANAGE'] },
  { key: 'security_settings', label: 'Form Güvenliği', permissions: ['SECURITY_SETTINGS_MANAGE'] },
  { key: 'integrations', label: 'API Anahtarları / Entegrasyonlar', permissions: ['INTEGRATIONS_MANAGE'] },
  { key: 'audit', label: 'İşlem Geçmişi', permissions: ['AUDIT_READ'] },
  { key: 'database_backup', label: 'Veritabanı Yedeği', permissions: ['DATABASE_BACKUP'] },
] as const satisfies ReadonlyArray<{ key: string; label: string; permissions: readonly AdminPermission[] }>;
export type AdminSectionKey = (typeof ADMIN_GRANT_SECTIONS)[number]['key'];
export const ADMIN_GRANT_SECTION_KEYS = [
  'dashboard', 'requests', 'transfer_operations', 'analytics', 'reservation_settings',
  'chat', 'chatbot', 'newsletter', 'fleet_pricing', 'content', 'translations',
  'ai_content', 'site_navigation', 'site_settings', 'security_settings',
  'integrations', 'audit', 'database_backup',
] as [AdminSectionKey, ...AdminSectionKey[]];
export type AdminGrant = { section: string; canView: boolean; canManage: boolean };
export type AdminCapabilities = Readonly<Record<AdminSectionKey, { canView: boolean; canManage: boolean }>> & {
  account: { canView: true; canManage: true };
  personel: { canView: boolean; canManage: boolean };
};

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

export function getAdminSectionForPermission(permission: AdminPermission): AdminSectionKey | undefined {
  return ADMIN_GRANT_SECTIONS.find(
    (section) => (section.permissions as readonly AdminPermission[]).includes(permission),
  )?.key;
}

export function resolveAdminCapabilities(role: unknown, grants: readonly AdminGrant[] = []): AdminCapabilities {
  const result = Object.fromEntries(
    ADMIN_GRANT_SECTIONS.map((section) => [section.key, { canView: false, canManage: false }]),
  ) as Record<AdminSectionKey, { canView: boolean; canManage: boolean }>;
  if (role === 'SUPER_ADMIN') {
    for (const section of ADMIN_GRANT_SECTIONS) result[section.key] = { canView: true, canManage: true };
  }
  for (const grant of grants) {
    if (!(grant.section in result)) continue;
    const canManage = !!grant.canManage;
    result[grant.section as AdminSectionKey] = {
      canView: !!grant.canView || canManage,
      canManage,
    };
  }
  return {
    ...result,
    account: { canView: true as const, canManage: true as const },
    personel: { canView: role === 'SUPER_ADMIN', canManage: role === 'SUPER_ADMIN' },
  };
}

export function hasAdminCapability(
  role: unknown,
  permission: AdminPermission,
  mode: 'view' | 'manage',
  grants: readonly AdminGrant[] = [],
): boolean {
  if (role === 'SUPER_ADMIN') return true;
  const section = getAdminSectionForPermission(permission);
  if (!section) return false;
  if (grants.length === 0) return false;
  const capability = resolveAdminCapabilities(role, grants)[section];
  return mode === 'manage' ? capability.canManage : capability.canView;
}

export function hasAdminSectionCapability(
  role: unknown,
  section: AdminSectionKey | 'account' | 'personel',
  mode: 'view' | 'manage',
  grants: readonly AdminGrant[] = [],
): boolean {
  if (role === 'SUPER_ADMIN') return true;
  if (section === 'account') return true;
  if (section === 'personel') return role === 'SUPER_ADMIN';
  const capability = resolveAdminCapabilities(role, grants)[section];
  return mode === 'manage' ? capability.canManage : capability.canView;
}

/** Resolve a route to its menu section without relying on overlapping permissions. */
export function getAdminSectionForPath(pathname: string): AdminSectionKey | 'account' | 'personel' | undefined {
  if (pathname.startsWith('/admin/api/logout') || pathname.startsWith('/admin/api/change-password') ||
      pathname.startsWith('/admin/hesabim') || pathname.startsWith('/admin/erisim-reddedildi')) return 'account';
  if (pathname.startsWith('/admin/api/staff') || pathname.startsWith('/admin/personel')) return 'personel';
  if (pathname.startsWith('/admin/api/chatbot/unread-count') ||
      pathname.startsWith('/admin/api/chatbot/messages') ||
      pathname.startsWith('/admin/api/chatbot/sessions') ||
      /^\/admin\/api\/chatbot\/[^/]+\/(?:messages|reply|resolve|takeover)(?:\/|$)/.test(pathname)) return 'chat';
  if (pathname.startsWith('/admin/api/chatbot') || pathname.startsWith('/admin/chatbot-bilgi-bankasi')) return 'chatbot';
  if (pathname.startsWith('/admin/api/newsletter') || pathname.startsWith('/admin/api/newsletter-export') ||
      pathname.startsWith('/admin/bulten-aboneleri')) return 'newsletter';
  if (pathname.startsWith('/admin/api/requests') || pathname.startsWith('/admin/talepler')) return 'requests';
  if (pathname.startsWith('/admin/api/analytics') || pathname.startsWith('/admin/istatistikler')) return 'analytics';
  if (pathname.startsWith('/admin/transferler')) return 'transfer_operations';
  if (pathname.startsWith('/admin/rezervasyon-ayarlari') || pathname.startsWith('/admin/api/reservation-settings') ||
      pathname.startsWith('/admin/api/custom-fields') || pathname.startsWith('/admin/api/service-types') ||
      pathname.startsWith('/admin/api/ek-hizmetler')) return 'reservation_settings';
  if (pathname.startsWith('/admin/sohbet')) return 'chat';
  if (pathname.startsWith('/admin/api/vehicles') || pathname.startsWith('/admin/api/vehicle-feature-defaults') ||
      pathname.startsWith('/admin/api/drivers') ||
      pathname.startsWith('/admin/api/transfers') || pathname.startsWith('/admin/api/transfer-routes') ||
      pathname.startsWith('/admin/api/locations') || pathname.startsWith('/admin/api/price-rules') ||
      pathname.startsWith('/admin/api/price-calculator') || pathname.startsWith('/admin/api/location-distance') ||
      pathname.startsWith('/admin/api/pricing/profiles') || pathname.startsWith('/admin/api/pricing/tolls') ||
      pathname.startsWith('/admin/araclar') || pathname.startsWith('/admin/soforler') ||
      pathname.startsWith('/admin/transfer-rotalari') || pathname.startsWith('/admin/fiyat-kurallari') ||
      pathname.startsWith('/admin/yol-gecis-ucretleri')) return 'fleet_pricing';
  if (pathname === '/admin' || pathname.startsWith('/admin/dashboard')) return 'dashboard';
  if (pathname.startsWith('/admin/api/pricing/quote')) return 'requests';
  if (pathname.startsWith('/admin/api/pricing/settings') || pathname.startsWith('/admin/api/pricing/exchange-rates') ||
      pathname.startsWith('/admin/api/flight-meet-greet') || pathname.startsWith('/admin/ucus-karsilama')) return 'reservation_settings';
  if (pathname.startsWith('/admin/api/content') || pathname.startsWith('/admin/api/blog') ||
      pathname.startsWith('/admin/api/categories') || pathname.startsWith('/admin/api/faqs') ||
      pathname.startsWith('/admin/api/homepage') ||
      pathname.startsWith('/admin/api/storage') ||
      pathname.startsWith('/admin/api/service-pages') || pathname.startsWith('/admin/api/topic-clusters') ||
      pathname.startsWith('/admin/blog') || pathname.startsWith('/admin/sayfalar') ||
      pathname.startsWith('/admin/hizmetler') || pathname.startsWith('/admin/kategoriler') ||
      pathname.startsWith('/admin/sss')) return 'content';
  if (pathname.startsWith('/admin/api/nav') || pathname.startsWith('/admin/menu')) return 'site_navigation';
  if (pathname.startsWith('/admin/api/translations') || pathname.startsWith('/admin/api/languages') ||
      pathname.startsWith('/admin/ceviriler') ||
      pathname.startsWith('/admin/dil-ve-ceviri')) return 'translations';
  if (pathname.startsWith('/admin/api/ai-content') || pathname.startsWith('/admin/api/ai-suggestions') ||
      pathname.startsWith('/admin/api/ai-writing') ||
      pathname.startsWith('/admin/api/studio') || pathname.startsWith('/admin/api/competitors') ||
      pathname.startsWith('/admin/ai-studio') || pathname.startsWith('/admin/ai-oneriler') ||
      pathname.startsWith('/admin/rakipler')) return 'ai_content';
  if (pathname.startsWith('/admin/api/database-backup') || pathname.startsWith('/admin/veritabani-yedegi')) return 'database_backup';
  if (pathname.startsWith('/admin/api/integration-secrets') || pathname.startsWith('/admin/api/social-platforms') ||
      pathname.startsWith('/admin/api/google-ads') || pathname.startsWith('/admin/api/gsc') ||
      pathname.startsWith('/admin/ayarlar/api-anahtarlari') ||
      pathname.startsWith('/admin/ayarlar/icerik-entegrasyonlari')) return 'integrations';
  if (pathname.startsWith('/admin/api/turnstile-settings') || pathname.startsWith('/admin/api/email-settings') ||
      pathname.startsWith('/admin/diller') || pathname.startsWith('/admin/e-posta-ayarlari') ||
      pathname.startsWith('/admin/ayarlar/guvenlik')) return 'security_settings';
  if (pathname.startsWith('/admin/api/settings')) return 'security_settings';
  if (pathname.startsWith('/admin/ayarlar')) return 'site_settings';
  if (pathname.startsWith('/admin/gecmis')) return 'audit';
  return undefined;
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
  if (pathname.startsWith('/admin/api/turnstile-settings')) return 'SECURITY_SETTINGS_MANAGE';
  if (pathname.startsWith('/admin/api/integration-secrets')) return 'INTEGRATIONS_MANAGE';
  if (pathname.startsWith('/admin/api/social-platforms') ||
      pathname.startsWith('/admin/api/google-ads') ||
      pathname.startsWith('/admin/api/gsc')) return 'INTEGRATIONS_MANAGE';
  if (pathname.startsWith('/admin/api/storage')) return 'MEDIA_MANAGE';
  // This endpoint issues a signed storage upload capability, not a CMS edit.
  // Keep it ahead of the broader homepage content prefix below.
  if (pathname === '/admin/api/homepage/media') return 'MEDIA_MANAGE';

  if (pathname.startsWith('/admin/api/requests')) return readOrWrite(method, 'RESERVATIONS_READ', 'RESERVATIONS_MANAGE');
  // Pricing never has a public route. Formula profiles are fleet data; tax/rate
  // policy is a site setting; generated quotes can be attached to reservations.
  if (pathname.startsWith('/admin/api/pricing/profiles')) return 'FLEET_MANAGE';
  if (pathname.startsWith('/admin/api/pricing/tolls')) return 'FLEET_MANAGE';
  if (pathname.startsWith('/admin/api/pricing/settings') ||
      pathname.startsWith('/admin/api/pricing/exchange-rates')) return 'SITE_SETTINGS_MANAGE';
  if (pathname.startsWith('/admin/api/pricing/quote')) return 'RESERVATIONS_MANAGE';
  if (pathname.startsWith('/admin/api/newsletter')) return readOrWrite(method, 'NEWSLETTER_READ', 'NEWSLETTER_MANAGE');
  if (pathname.startsWith('/admin/api/chatbot/settings')) return 'SITE_SETTINGS_MANAGE';
  if (pathname.startsWith('/admin/api/chatbot')) return 'CHAT_MANAGE';
  if (pathname.startsWith('/admin/api/analytics')) return 'ANALYTICS_READ';
  if (pathname.startsWith('/admin/api/competitors')) return 'AI_USE';

  if (pathname.startsWith('/admin/api/vehicles') ||
      pathname.startsWith('/admin/api/drivers') ||
      pathname.startsWith('/admin/api/transfers') ||
      pathname.startsWith('/admin/api/vehicle-feature-defaults') ||
      pathname.startsWith('/admin/api/locations') ||
      pathname.startsWith('/admin/api/price-rules') ||
      pathname.startsWith('/admin/api/price-calculator')) return 'FLEET_MANAGE';
  // Route AI drafting consumes AI capability; route image generation/upload
  // consumes media capability. Keep these ahead of the route CRUD mapping.
  if (pathname.startsWith('/admin/api/transfer-routes/ai-fill')) return 'AI_USE';
  if (pathname.startsWith('/admin/api/transfer-routes/image')) return 'MEDIA_MANAGE';
  if (pathname.startsWith('/admin/api/transfer-routes')) return 'FLEET_MANAGE';
  if (pathname.startsWith('/admin/api/flight-meet-greet')) return 'SITE_SETTINGS_MANAGE';
  if (pathname.startsWith('/admin/api/reservation-settings') ||
      pathname.startsWith('/admin/api/custom-fields') ||
      pathname.startsWith('/admin/api/service-types') ||
      pathname.startsWith('/admin/api/ek-hizmetler')) return 'SITE_SETTINGS_MANAGE';
  if (pathname.startsWith('/admin/api/location-distance')) return 'FLEET_MANAGE';
  if (pathname.startsWith('/admin/api/settings') || pathname.startsWith('/admin/api/languages')) {
    return 'SECURITY_SETTINGS_MANAGE';
  }

  // Publishing translations changes public content; keep this exact route
  // ahead of the broader translation-management mapping.
  if (pathname === '/admin/api/translations/bulk-publish') return 'CONTENT_PUBLISH';
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
  return pathname === '/admin/api/cron/weekly-draft' ||
    pathname === '/admin/api/cron/draft-cadence' ||
    pathname === '/admin/api/cron/google-business-reviews' ||
    pathname === '/admin/api/cron/blog-cache-revalidation';
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
  if (pathname.startsWith('/admin/ayarlar/api-anahtarlari')) return 'INTEGRATIONS_MANAGE';
  if (pathname.startsWith('/admin/ayarlar/icerik-entegrasyonlari')) return 'INTEGRATIONS_MANAGE';
  if (pathname.startsWith('/admin/ayarlar/guvenlik')) return 'SECURITY_SETTINGS_MANAGE';
  if (pathname.startsWith('/admin/veritabani-yedegi')) return 'DATABASE_BACKUP';
  if (pathname.startsWith('/admin/ayarlar') || pathname.startsWith('/admin/rezervasyon-ayarlari')) {
    return 'SITE_SETTINGS_MANAGE';
  }
  if (pathname.startsWith('/admin/ucus-karsilama')) return 'SITE_SETTINGS_MANAGE';
  if (pathname.startsWith('/admin/ek-hizmetler')) return 'SITE_SETTINGS_MANAGE';
  if (pathname.startsWith('/admin/talepler')) return 'RESERVATIONS_READ';
  if (pathname.startsWith('/admin/bulten-aboneleri')) return 'NEWSLETTER_READ';
  if (pathname.startsWith('/admin/araclar') || pathname.startsWith('/admin/transfer-rotalari') || pathname.startsWith('/admin/fiyat-kurallari') || pathname.startsWith('/admin/yol-gecis-ucretleri')) return 'FLEET_MANAGE';
  if (pathname.startsWith('/admin/transferler') || pathname.startsWith('/admin/soforler')) return 'FLEET_MANAGE';
  if (pathname.startsWith('/admin/ai-studio') || pathname.startsWith('/admin/ai-oneriler')) return 'AI_USE';
  if (pathname.startsWith('/admin/rakipler')) return 'AI_USE';
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