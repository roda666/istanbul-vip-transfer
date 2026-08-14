/**
 * Server-side utility for reading service page CMS content.
 * Uses the `content` table (contentType='SERVICE') for Turkish source,
 * and `content_translations` for EN/DE/RU/AR locales.
 *
 * entity_type = 'service_page'  (distinct from 'content' used by blog posts)
 */
import 'server-only';
import { parseServicePageBody, type ServicePageBody, type ServicePageRecord, type ServicePageTranslation } from './service-page-types';

export const ENTITY_TYPE = 'service_page';

// ── Visibility map (for public consumers) ────────────────────────────────────

/**
 * Returns a map of slug → { showOnHomepage, showInNav } for all active
 * PUBLISHED service pages.  Public components (homepage service grid, nav)
 * should call this to honour admin visibility toggles.
 *
 * Gracefully returns an empty map on DB error so public pages continue to
 * render from their static fallback list.
 */
export async function getServiceVisibilityMap(): Promise<Map<string, { showOnHomepage: boolean; showInNav: boolean }>> {
  try {
    const { db }                  = await import('@/db');
    const { content }             = await import('@/db/schema');
    const { eq, and }             = await import('drizzle-orm');

    const rows = await db
      .select({ slug: content.slug, showOnHomepage: content.showOnHomepage, showInNav: content.showInNav })
      .from(content)
      .where(and(eq(content.contentType, 'SERVICE'), eq(content.status, 'PUBLISHED'), eq(content.isActive, true)));

    return new Map(rows.map(r => [r.slug, { showOnHomepage: r.showOnHomepage, showInNav: r.showInNav }]));
  } catch {
    return new Map();
  }
}

// ── Public read (published content) ──────────────────────────────────────────

export interface PublishedServicePage {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  heroImage: string | null;
  heroImageAlt: string | null;
  ogImage: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  indexable: boolean;
  isActive: boolean;
  category: string | null;
  body: ServicePageBody | null;
}

/**
 * Returns the PUBLISHED service page for a given slug and locale.
 * For TR: reads from `content` table directly.
 * For non-TR: reads from `content_translations` (status=PUBLISHED).
 * Returns null if not found, not published, or not active.
 */
export async function getPublishedServicePage(
  slug: string,
  locale: string,
): Promise<PublishedServicePage | null> {
  try {
    const { db }                     = await import('@/db');
    const { content, contentTranslations } = await import('@/db/schema');
    const { eq, and, inArray }       = await import('drizzle-orm');

    // Always fetch the source TR record first (to check is_active and get id)
    const [src] = await db
      .select()
      .from(content)
      .where(and(eq(content.slug, slug), eq(content.contentType, 'SERVICE')))
      .limit(1);

    if (!src) return null;
    if (!src.isActive || src.status !== 'PUBLISHED') return null;

    if (locale === 'tr') {
      return {
        id:             src.id,
        slug:           src.slug,
        title:          src.title,
        excerpt:        src.excerpt ?? null,
        heroImage:      src.heroImage ?? null,
        heroImageAlt:   src.heroImageAlt ?? null,
        ogImage:        src.ogImage ?? null,
        seoTitle:       src.seoTitle ?? null,
        seoDescription: src.seoDescription ?? null,
        indexable:      src.indexable,
        isActive:       src.isActive,
        category:       src.category ?? null,
        body:           parseServicePageBody(src.body),
      };
    }

    // Non-TR: look up published translation
    const [tx] = await db
      .select()
      .from(contentTranslations)
      .where(and(
        eq(contentTranslations.entityType,          ENTITY_TYPE),
        eq(contentTranslations.entityId,            src.id),
        eq(contentTranslations.targetLanguageCode,  locale),
        // OUTDATED translations are still publicly visible (content is stale but live).
        // They will be retranslated and re-published via the admin workflow.
        inArray(contentTranslations.status, ['PUBLISHED', 'OUTDATED']),
      ))
      .limit(1);

    if (!tx) return null;

    return {
      id:             src.id,
      slug:           src.slug,
      title:          tx.title ?? src.title,
      excerpt:        tx.excerpt ?? src.excerpt ?? null,
      heroImage:      src.heroImage ?? null,
      heroImageAlt:   tx.imageAlt ?? src.heroImageAlt ?? null,
      ogImage:        src.ogImage ?? null,
      seoTitle:       tx.metaTitle ?? src.seoTitle ?? null,
      seoDescription: tx.metaDescription ?? src.seoDescription ?? null,
      indexable:      src.indexable,
      isActive:       src.isActive,
      category:       src.category ?? null,
      body:           parseServicePageBody(tx.body) ?? parseServicePageBody(src.body),
    };
  } catch {
    return null;
  }
}

/**
 * Returns language codes that have a PUBLISHED version of this service page.
 * Turkish ('tr') is always included when the source record is published + active.
 * Falls back to ['tr'] if the DB is unavailable.
 */
export async function getPublishedServicePageLangs(slug: string): Promise<string[]> {
  try {
    const { db }                          = await import('@/db');
    const { content, contentTranslations } = await import('@/db/schema');
    const { eq, and, inArray }            = await import('drizzle-orm');

    const [src] = await db
      .select({ id: content.id, status: content.status, isActive: content.isActive })
      .from(content)
      .where(and(eq(content.slug, slug), eq(content.contentType, 'SERVICE')))
      .limit(1);

    if (!src) return [];
    if (!src.isActive || src.status !== 'PUBLISHED') return [];

    const txRows = await db
      .select({ lang: contentTranslations.targetLanguageCode })
      .from(contentTranslations)
      .where(
        and(
          eq(contentTranslations.entityType,   ENTITY_TYPE),
          eq(contentTranslations.entityId,     src.id),
          // Include OUTDATED: translation is still live, just pending refresh
          inArray(contentTranslations.status, ['PUBLISHED', 'OUTDATED']),
        ),
      );

    const langs = ['tr', ...txRows.map((r) => r.lang)];
    // Deduplicate (defensive; 'tr' should never appear as a translation lang)
    return [...new Set(langs)];
  } catch {
    return ['tr'];
  }
}

// ── Admin read (draft + published) ───────────────────────────────────────────

/**
 * Returns the full admin record for a service page, including all translation rows.
 * Throws on DB error.
 */
export async function getServicePageAdminRecord(id: string): Promise<ServicePageRecord> {
  const { db }                           = await import('@/db');
  const { content, contentTranslations, languages } = await import('@/db/schema');
  const { eq, and }                      = await import('drizzle-orm');

  const [row] = await db
    .select()
    .from(content)
    .where(and(eq(content.id, id), eq(content.contentType, 'SERVICE')))
    .limit(1);

  if (!row) throw new Error('Not found');

  // All active enabled non-TR languages
  const langs = await db
    .select({ code: languages.code })
    .from(languages)
    .where(eq(languages.isEnabled, true));

  const targetLangs = langs.map(l => l.code).filter(c => c !== 'tr');

  // Fetch all translation rows for this content id
  const txRows = await db
    .select()
    .from(contentTranslations)
    .where(and(
      eq(contentTranslations.entityType, ENTITY_TYPE),
      eq(contentTranslations.entityId,   id),
    ));

  const txByLang = new Map(txRows.map(tx => [tx.targetLanguageCode, tx]));

  const translations: ServicePageTranslation[] = targetLangs.map(locale => {
    const tx = txByLang.get(locale);
    return {
      id:               tx?.id ?? null,
      locale,
      status:           tx?.status ?? 'NOT_STARTED',
      title:            tx?.title ?? null,
      excerpt:          tx?.excerpt ?? null,
      body:             tx ? parseServicePageBody(tx.body) : null,
      metaTitle:        tx?.metaTitle ?? null,
      metaDescription:  tx?.metaDescription ?? null,
      imageAlt:         tx?.imageAlt ?? null,
      sourceHash:       tx?.sourceHash ?? null,
      isManuallyLocked: tx?.isManuallyLocked ?? false,
      isAiGenerated:    tx?.isAiGenerated ?? false,
      publishedAt:      tx?.publishedAt?.toISOString() ?? null,
      failureReason:    tx?.failureReason ?? null,
      updatedAt:        tx?.updatedAt?.toISOString() ?? null,
    };
  });

  return {
    id:             row.id,
    slug:           row.slug,
    title:          row.title,
    excerpt:        row.excerpt ?? null,
    heroImage:      row.heroImage ?? null,
    heroImageAlt:   row.heroImageAlt ?? null,
    ogImage:        row.ogImage ?? null,
    seoTitle:       row.seoTitle ?? null,
    seoDescription: row.seoDescription ?? null,
    canonicalUrl:   row.canonicalUrl ?? null,
    indexable:      row.indexable,
    isActive:       row.isActive,
    displayOrder:   row.displayOrder,
    category:       row.category ?? null,
    showOnHomepage: row.showOnHomepage,
    showInNav:      row.showInNav,
    status:         row.status,
    publishedAt:    row.publishedAt?.toISOString() ?? null,
    updatedAt:      row.updatedAt.toISOString(),
    body:           parseServicePageBody(row.body),
    draftBody:      parseServicePageBody(row.draftBody ?? null),
    translations,
  };
}
