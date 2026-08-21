/**
 * Server-side utility for reading and writing homepage CMS content.
 * Uses the existing `content` table (slug='ana-sayfa') for the Turkish source,
 * and `content_translations` for EN/DE/RU/AR/FR/ES/IT/NL locales.
 */
import type { HomepageSections } from './homepage-types';
import { parseHomepageSections, HOMEPAGE_FALLBACK } from './homepage-types';
import { syncSharedFields } from './homepage-sync';

const HOMEPAGE_SLUG = 'ana-sayfa';
const CACHE_TAG = 'homepage-cms';

/** Revalidation tags for each locale homepage. */
export const LOCALE_REVALIDATION_TAGS: Record<string, string> = {
  tr: 'homepage-tr',
  en: 'homepage-en',
  de: 'homepage-de',
  ru: 'homepage-ru',
  ar: 'homepage-ar',
  es: 'homepage-es',
  fr: 'homepage-fr',
  it: 'homepage-it',
  nl: 'homepage-nl',
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
      .select({ id: content.id, body: content.body, status: content.status })
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
    if (!parsed) {
      return HOMEPAGE_FALLBACK[locale] as HomepageSections ?? HOMEPAGE_FALLBACK.en as HomepageSections;
    }

    // Shared fields (including the hero image) are always owned by the
    // published Turkish source. Overlay them at read time so a stale or
    // manually protected translation can never show an outdated asset.
    const publishedSource = src.status === 'PUBLISHED'
      ? parseHomepageSections(src.body)
      : null;
    return publishedSource ? syncSharedFields(parsed, publishedSource) : parsed;
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
  // Translation sync fields (null for TR source)
  sourceHash: string | null;
  isManuallyLocked: boolean;
  lockedAt: Date | null;
  failureReason: string | null;
  lastTranslatedAt: Date | null;
  isAiGenerated: boolean;
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
      sourceHash: null,
      isManuallyLocked: false,
      lockedAt: null,
      failureReason: null,
      lastTranslatedAt: null,
      isAiGenerated: false,
    };
  }

  const [src] = await db
    .select({ id: content.id })
    .from(content)
    .where(eq(content.slug, HOMEPAGE_SLUG))
    .limit(1);

  if (!src) {
    return {
      id: null, locale, status: 'NOT_STARTED', sections: null,
      updatedAt: null, publishedAt: null,
      sourceHash: null, isManuallyLocked: false, lockedAt: null,
      failureReason: null, lastTranslatedAt: null, isAiGenerated: false,
    };
  }

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
    sourceHash: tx?.sourceHash ?? null,
    isManuallyLocked: tx?.isManuallyLocked ?? false,
    lockedAt: tx?.lockedAt ?? null,
    failureReason: tx?.failureReason ?? null,
    lastTranslatedAt: tx?.draftAt ?? tx?.updatedAt ?? null,
    isAiGenerated: tx?.isAiGenerated ?? false,
  };
}

export { CACHE_TAG, HOMEPAGE_SLUG };
