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
  // Şifre Yenile is a real personnel-only domain action. AdminRecordActions
  // places it in the canonical `custom` slot before delete.
  personel: ['edit', 'activation', 'custom', 'delete'],
  menu: ['up', 'down', 'edit', 'delete'],
  'transfer-rotalari': ['up', 'down', 'edit', 'activation', 'delete'],
  sss: ['up', 'down', 'edit', 'delete'],
  lokasyonlar: ['up', 'down', 'edit', 'activation', 'archive', 'delete'],
  'ek-hizmetler': ['up', 'down', 'edit', 'activation', 'archive', 'delete'],
  // Transfer operations currently expose inline assignment fields, not record
  // actions. Keeping the screen in the inventory prevents future local action
  // buttons from bypassing AdminRecordActions.
  transferler: [],
};