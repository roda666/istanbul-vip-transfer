import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;

/**
 * Static sitemap entries — Turkish root pages.
 *
 * Excluded intentionally:
 *  - /istanbul-bursa-transfer, /istanbul-sapanca-transfer,
 *    /istanbul-gunubirlik-turlar, /sapanca-masukiye-turu,
 *    /bursa-gunubirlik-tur, /yalova-gunubirlik-tur  — noindex until content approved
 */
const STATIC_ENTRIES: MetadataRoute.Sitemap = [
  { url: BASE, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },

  // Airport transfer pages
  { url: `${BASE}/istanbul-havalimani-transfer`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
  { url: `${BASE}/sabiha-gokcen-havalimani-transfer`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },

  // Service pages
  { url: `${BASE}/vip-transfer`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
  { url: `${BASE}/hizmetler`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
  { url: `${BASE}/sehirler-arasi-transfer`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
  { url: `${BASE}/soforlu-arac-kiralama`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.75 },
  { url: `${BASE}/otel-transfer`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.75 },
  { url: `${BASE}/saglik-turizmi-transfer`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.75 },
  { url: `${BASE}/kurumsal-vip-transfer`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.75 },

  // Info pages
  { url: `${BASE}/araclar`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  { url: `${BASE}/hakkimizda`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  { url: `${BASE}/iletisim`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },

  // Blog index
  { url: `${BASE}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.65 },

  // Blog articles (Turkish)
  { url: `${BASE}/blog/istanbul-havalimani-transfer-rehberi`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  { url: `${BASE}/blog/sabiha-gokcen-transfer-rehberi`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  { url: `${BASE}/blog/vip-transfer-ile-taksi-arasindaki-farklar`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [...STATIC_ENTRIES];

  // Translated homepages — one per active+published language (single source
  // of truth: the languages table; falls back to tr/en/de/ru/ar).
  const { getPublicLangCodes } = await import('@/lib/i18n/active-locales');
  const publicLangs = await getPublicLangCodes();
  const translatedHomepageLangs = publicLangs.filter((l) => l !== 'tr');

  for (const lang of translatedHomepageLangs) {
    entries.push({
      url: `${BASE}/${lang}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.85,
    });
  }

  // Dynamically add PUBLISHED translations from the database
  try {
    const { db } = await import('@/db');
    const { contentTranslations } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const published = await db
      .select({
        slug: contentTranslations.slug,
        targetLanguageCode: contentTranslations.targetLanguageCode,
        publishedAt: contentTranslations.publishedAt,
        entityType: contentTranslations.entityType,
      })
      .from(contentTranslations)
      .where(eq(contentTranslations.status, 'PUBLISHED'));

    for (const row of published) {
      if (!row.slug) continue;
      const lang = row.targetLanguageCode;
      // Never leak a translation whose language is not publicly active
      if (!publicLangs.includes(lang)) continue;
      let url: string | null = null;

      if (row.entityType === 'content') {
        url = `${BASE}/${lang}/blog/${row.slug}`;
      }

      if (url) {
        entries.push({
          url,
          lastModified: row.publishedAt ?? new Date(),
          changeFrequency: 'monthly',
          priority: 0.55,
        });
      }
    }
  } catch {
    // DB not yet available (first deploy, migration not run) — silently skip translations
  }

  return entries;
}
