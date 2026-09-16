export const CUSTOMER_CMS_LOCALES = ['tr', 'en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'] as const;
export type CustomerCmsLocale = typeof CUSTOMER_CMS_LOCALES[number];

export type AdminCmsStatus = 'current' | 'translated' | 'published' | 'translating' | 'draft' | 'outdated' | 'failed';

const STATUS_ALIASES: Record<string, AdminCmsStatus> = {
  PUBLISHED: 'published',
  APPROVED: 'current',
  ACTIVE: 'published',
  QUEUED: 'translating',
  RUNNING: 'translating',
  TRANSLATING: 'translating',
  RETRYING: 'translating',
  DRAFT: 'draft',
  REVIEW: 'draft',
  OUTDATED: 'outdated',
  FAILED: 'failed',
  ARCHIVED: 'draft',
  CURRENT: 'current',
  TRANSLATED: 'translated',
};

export function normalizeAdminCmsStatus(status: unknown): AdminCmsStatus {
  if (typeof status !== 'string') return 'draft';
  return STATUS_ALIASES[status.toUpperCase()] ?? 'draft';
}

export function adminCmsStatusLabel(status: AdminCmsStatus): string {
  return {
    current: 'Güncel',
    translated: 'Çevrildi',
    published: 'Yayında',
    translating: 'Çevriliyor',
    draft: 'Taslak',
    outdated: 'Güncel değil',
    failed: 'Hata',
  }[status];
}

export function normalizeAdminCmsLanguageStatuses(
  statuses: Record<string, unknown> | null | undefined,
): Record<CustomerCmsLocale, AdminCmsStatus> {
  return Object.fromEntries(CUSTOMER_CMS_LOCALES.map(locale => [
    locale,
    normalizeAdminCmsStatus(statuses?.[locale] ?? (locale === 'tr' ? 'PUBLISHED' : undefined)),
  ])) as Record<CustomerCmsLocale, AdminCmsStatus>;
}