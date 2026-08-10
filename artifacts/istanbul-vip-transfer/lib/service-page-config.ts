/**
 * Shared service-page configuration.
 *
 * Single source of truth for slug → PageHero key mapping and the set of slugs
 * that use a 2-crumb breadcrumb (Home → Page) rather than the default 3-crumb
 * layout (Home → Hizmetler → Page).
 *
 * Import from here whenever breadcrumb or pageKey logic needs to reference a slug.
 */
import type { PageKey } from '@/components/PageHero';

/** Slug → PageHero pageKey mapping (used as static i18n fallback). */
export const SLUG_TO_PAGE_KEY: Record<string, PageKey> = {
  'istanbul-havalimani-transfer':      'istHava',
  'sabiha-gokcen-havalimani-transfer': 'sabiha',
  'vip-transfer':                      'vipTransfer',
  'sehirler-arasi-transfer':           'sehirlerArasi',
  'soforlu-arac-kiralama':             'soforlu',
  'otel-transfer':                     'otel',
  'saglik-turizmi-transfer':           'saglik',
  'kurumsal-vip-transfer':             'kurumsal',
  'istanbul-bursa-transfer':           'istBursa',
  'istanbul-sapanca-transfer':         'istSapanca',
  'istanbul-gunubirlik-turlar':        'istGunubirlik',
  'sapanca-masukiye-turu':             'sapanca',
  'bursa-gunubirlik-tur':              'bursa',
  'yalova-gunubirlik-tur':             'yalova',
};

/**
 * Slugs that display a 2-crumb breadcrumb (Home → Page).
 * All other service-page slugs use the default 3-crumb layout
 * (Home → Hizmetler → Page).
 */
export const TWO_CRUMB_SLUGS = new Set([
  'istanbul-havalimani-transfer',
  'sabiha-gokcen-havalimani-transfer',
  'vip-transfer',
  'sehirler-arasi-transfer',
]);
