/**
 * Server-side utility for reading and writing homepage CMS content.
 * Uses the existing `content` table (slug='ana-sayfa') for the Turkish source,
 * and `content_translations` for EN/DE/RU/AR locales.
 */
import type { HomepageSections } from './homepage-types';
import { parseHomepageSections, HOMEPAGE_FALLBACK } from './homepage-types';

const HOMEPAGE_SLUG = 'ana-sayfa';
const CACHE_TAG = 'homepage-cms';

/** Revalidation tags for each locale homepage. */
export const LOCALE_REVALIDATION_TAGS: Record<string, string> = {
  tr: 'homepage-tr',
  en: 'homepage-en',
  de: 'homepage-de',
  ru: 'homepage-ru',
  ar: 'homepage-ar',
};

// ── Read published content (public pages) ─────────────────────────────────

/**
 * Returns the PUBLISHED homepage sections for a given locale.
 * Falls back to the static i18n-matched fallback if the DB is unavailable
 * or no published content exists.
 *
 * This function is designed to be called from RSC (server components only).
 * It does NOT cache — rely on Next.js `fetch` or ISR revalidation at the
 * page level.
 */
export async function getPublishedHomepageData(locale: string): Promise<HomepageSections> {
  try {
    const { db } = await import('@/db');
    const { content, contentTranslations } = await import('@/db/schema');
    const { eq, and } = await import('drizzle-orm');

    if (locale === 'tr') {
      const [row] = await db
        .select({ body: content.body })
        .from(content)
        .where(and(eq(content.slug, HOMEPAGE_SLUG), eq(content.status, 'PUBLISHED')))
        .limit(1);
      const parsed = parseHomepageSections(row?.body);
      return parsed ?? (HOMEPAGE_FALLBACK.tr as HomepageSections);
    }

    // For non-Turkish locales, read the source record id first, then translations
    const [src] = await db
      .select({ id: content.id })
      .from(content)
      .where(eq(content.slug, HOMEPAGE_SLUG))
      .limit(1);

    if (!src) return HOMEPAGE_FALLBACK[locale] as HomepageSections ?? HOMEPAGE_FALLBACK.en as HomepageSections;

    const [tx] = await db
      .select({ body: contentTranslations.body })
      .from(contentTranslations)
      .where(
        and(
          eq(contentTranslations.entityType, 'homepage'),
          eq(contentTranslations.entityId, src.id),
          eq(contentTranslations.targetLanguageCode, locale),
          eq(contentTranslations.status, 'PUBLISHED'),
        ),
      )
      .limit(1);

    const parsed = parseHomepageSections(tx?.body);
    return parsed ?? (HOMEPAGE_FALLBACK[locale] as HomepageSections ?? HOMEPAGE_FALLBACK.en as HomepageSections);
  } catch {
    // DB unavailable — return static fallback so the page still renders
    return HOMEPAGE_FALLBACK[locale] as HomepageSections ?? HOMEPAGE_FALLBACK.en as HomepageSections;
  }
}

// ── Admin read (draft + published) ────────────────────────────────────────

export interface HomepageAdminRecord {
  id: string | null;
  locale: string;
  status: string;
  sections: HomepageSections | null;
  updatedAt: Date | null;
  publishedAt: Date | null;
}

/** Returns the latest (draft or published) homepage record for a locale for admin editing. */
export async function getHomepageAdminRecord(locale: string): Promise<HomepageAdminRecord> {
  const { db } = await import('@/db');
  const { content, contentTranslations } = await import('@/db/schema');
  const { eq, and } = await import('drizzle-orm');

  if (locale === 'tr') {
    const [row] = await db
      .select()
      .from(content)
      .where(eq(content.slug, HOMEPAGE_SLUG))
      .limit(1);

    return {
      id: row?.id ?? null,
      locale,
      status: row?.status ?? 'DRAFT',
      sections: parseHomepageSections(row?.body),
      updatedAt: row?.updatedAt ?? null,
      publishedAt: row?.publishedAt ?? null,
    };
  }

  const [src] = await db
    .select({ id: content.id })
    .from(content)
    .where(eq(content.slug, HOMEPAGE_SLUG))
    .limit(1);

  if (!src) return { id: null, locale, status: 'DRAFT', sections: null, updatedAt: null, publishedAt: null };

  const [tx] = await db
    .select()
    .from(contentTranslations)
    .where(
      and(
        eq(contentTranslations.entityType, 'homepage'),
        eq(contentTranslations.entityId, src.id),
        eq(contentTranslations.targetLanguageCode, locale),
      ),
    )
    .limit(1);

  return {
    id: tx?.id ?? null,
    locale,
    status: tx?.status ?? 'NOT_STARTED',
    sections: parseHomepageSections(tx?.body),
    updatedAt: tx?.updatedAt ?? null,
    publishedAt: tx?.publishedAt ?? null,
  };
}

export { CACHE_TAG };
