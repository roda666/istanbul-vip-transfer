/**
 * Server-side language readiness helpers.
 *
 * A catalog language may be created and translated privately, but it must not
 * become public until every currently published CMS source has a published
 * translation. This keeps a new locale from exposing Turkish source content.
 */
import 'server-only';

export type TranslationEntityType = 'content' | 'homepage' | 'service_page';

export interface PublishedContentSource {
  id: string;
  slug: string;
  contentType: string;
}

export interface LanguagePublicationReadiness {
  ready: boolean;
  requiredCount: number;
  publishedCount: number;
  missing: Array<{ entityType: TranslationEntityType; entityId: string; slug: string }>;
}

/** Maps a published CMS source to the translation row used by its public page. */
export function getTranslationEntityTypeForContent(source: Pick<PublishedContentSource, 'slug' | 'contentType'>): TranslationEntityType {
  if (source.slug === 'ana-sayfa') return 'homepage';
  if (source.contentType === 'SERVICE') return 'service_page';
  return 'content';
}

async function getPublishedSources(): Promise<PublishedContentSource[]> {
  const { db } = await import('@/db');
  const { content } = await import('@/db/schema');
  const { and, eq, inArray } = await import('drizzle-orm');

  const rows = await db.select({
    id: content.id,
    slug: content.slug,
    contentType: content.contentType,
  }).from(content).where(and(
    eq(content.status, 'PUBLISHED'),
    inArray(content.contentType, ['PAGE', 'SERVICE', 'BLOG_POST']),
  ));

  return rows.map((row) => ({ ...row, id: String(row.id) }));
}

/**
 * Returns the minimum CMS readiness for public locale launch.
 * It intentionally checks published sources only: drafts do not belong in a
 * public-language gate and can be translated later through the normal queue.
 */
export async function getLanguagePublicationReadiness(languageCode: string): Promise<LanguagePublicationReadiness> {
  const [{ db }, { contentTranslations }] = await Promise.all([
    import('@/db'),
    import('@/db/schema'),
  ]);
  const { eq } = await import('drizzle-orm');

  const [sources, translations] = await Promise.all([
    getPublishedSources(),
    db.select({
      entityType: contentTranslations.entityType,
      entityId: contentTranslations.entityId,
      status: contentTranslations.status,
      title: contentTranslations.title,
      body: contentTranslations.body,
    }).from(contentTranslations).where(eq(contentTranslations.targetLanguageCode, languageCode)),
  ]);

  const published = new Map(
    translations
      // Every public renderer in this source set requires both a localized
      // display title and content body. Either field missing risks a fallback
      // to Turkish source text in metadata or the page itself.
      .filter((row) => row.status === 'PUBLISHED' && Boolean(row.title?.trim() && row.body?.trim()))
      .map((row) => [`${row.entityType}:${row.entityId}`, row]),
  );
  const missing = sources.flatMap((source) => {
    const entityType = getTranslationEntityTypeForContent(source);
    return published.has(`${entityType}:${source.id}`)
      ? []
      : [{ entityType, entityId: source.id, slug: source.slug }];
  });

  return {
    ready: missing.length === 0,
    requiredCount: sources.length,
    publishedCount: sources.length - missing.length,
    missing: missing.slice(0, 25),
  };
}

/**
 * Creates idempotent NOT_STARTED rows for every currently published CMS source.
 * The rows make a newly added language visible to translation tooling without
 * treating unreviewed content as public.
 */
export async function initializeLanguageTranslationPlaceholders(
  languageCode: string,
  adminId: string,
): Promise<number> {
  const [{ db }, { contentTranslations }] = await Promise.all([
    import('@/db'),
    import('@/db/schema'),
  ]);
  const sources = await getPublishedSources();
  if (sources.length === 0) return 0;

  const inserted = await db.insert(contentTranslations).values(
    sources.map((source) => ({
      entityType: getTranslationEntityTypeForContent(source),
      entityId: source.id,
      sourceLanguageCode: 'tr',
      targetLanguageCode: languageCode,
      status: 'NOT_STARTED' as const,
      createdBy: adminId,
      updatedBy: adminId,
    })),
  ).onConflictDoNothing().returning({ id: contentTranslations.id });

  return inserted.length;
}