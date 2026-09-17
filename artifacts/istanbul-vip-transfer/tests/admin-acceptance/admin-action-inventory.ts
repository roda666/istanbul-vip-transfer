/**
 * Domain applicability, not a second visual implementation. Every screen
 * renders applicable actions through AdminRecordActions in canonical order;
 * actions which have no domain meaning are intentionally omitted.
 */
export const ADMIN_ACTION_APPLICABILITY: Record<string, string[]> = {
  blog: ['up', 'down', 'edit', 'delete'],
  hizmetler: ['up', 'down', 'edit', 'archive', 'custom', 'delete'],
  araclar: ['up', 'down', 'edit', 'activation', 'archive', 'delete'],
  soforler: ['up', 'down', 'edit', 'activation', 'delete'],
  kategoriler: ['up', 'down', 'edit', 'activation', 'delete'],
  rakipler: ['edit', 'delete'],
  personel: ['edit', 'activation', 'delete'],
  menu: ['up', 'down', 'edit', 'delete'],
  'transfer-rotalari': ['up', 'down', 'edit', 'activation', 'delete'],
  sss: ['up', 'down', 'edit', 'delete'],
  lokasyonlar: ['up', 'down', 'edit', 'activation', 'archive', 'delete'],
  'ek-hizmetler': ['up', 'down', 'edit', 'activation', 'archive', 'delete'],
};