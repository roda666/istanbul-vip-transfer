/**
 * CMS list query for the public /hizmetler service listing pages.
 *
 * Separate from service-page-cms.ts (single-page reads) to avoid
 * circular imports when HizmetlerServiceGridCms imports this file.
 *
 * entity_type = 'service_page' (matches ENTITY_TYPE in service-page-cms.ts)
 */
import 'server-only';

export interface PublishedServiceListItem {
  slug:         string;
  title:        string;
  excerpt:      string | null;
  category:     string | null;
  displayOrder: number;
  heroImage:    string | null;
}

/**
 * Returns all PUBLISHED, active service pages for the given locale.
 *
 * - `tr`    : queries the `content` table directly.
 * - non-TR  : inner-joins with `content_translations` (status = 'PUBLISHED' only).
 *             OUTDATED translations are intentionally excluded from the list page
 *             so visitors see only fresh, fully-reviewed translations.
 *
 * Returns `[]` on DB error (caller should handle empty state gracefully).
 */
export async function getPublishedServiceList(
  locale: string,
): Promise<PublishedServiceListItem[]> {
  try {
    const { db }                        = await import('@/db');
    const { content, contentTranslations } = await import('@/db/schema');
    const { eq, and, asc, inArray, sql } = await import('drizzle-orm');

    if (locale === 'tr') {
      const rows = await db
        .select({
          slug:         content.slug,
          title:        content.title,
          excerpt:      content.excerpt,
          category:     content.category,
          displayOrder: content.displayOrder,
          heroImage:    content.heroImage,
        })
        .from(content)
        .where(and(
          eq(content.contentType, 'SERVICE'),
          eq(content.status,      'PUBLISHED'),
          eq(content.isActive,    true),
        ))
        .orderBy(asc(content.displayOrder));

      return rows.map((r) => ({
        slug:         r.slug,
        title:        r.title,
        excerpt:      r.excerpt ?? null,
        category:     r.category ?? null,
        displayOrder: r.displayOrder ?? 99,
        heroImage:    r.heroImage ?? null,
      }));
    }

    // Non-TR: require PUBLISHED translation (not just OUTDATED) for list visibility
    const rows = await db
      .select({
        slug:         content.slug,
        txTitle:      contentTranslations.title,
        srcTitle:     content.title,
        txExcerpt:    contentTranslations.excerpt,
        srcExcerpt:   content.excerpt,
        category:     content.category,
        displayOrder: content.displayOrder,
        heroImage:    content.heroImage,
      })
      .from(content)
      .innerJoin(
        contentTranslations,
        and(
          // entity_id is TEXT, content.id is UUID — explicit cast required
          sql`${contentTranslations.entityId}::uuid = ${content.id}`,
          eq(contentTranslations.targetLanguageCode,  locale),
          eq(contentTranslations.entityType,          'service_page'),
          inArray(contentTranslations.status,         ['PUBLISHED']),
        ),
      )
      .where(and(
        eq(content.contentType, 'SERVICE'),
        eq(content.status,      'PUBLISHED'),
        eq(content.isActive,    true),
      ))
      .orderBy(asc(content.displayOrder));

    return rows.map((r) => ({
      slug:         r.slug,
      title:        r.txTitle ?? r.srcTitle,
      excerpt:      r.txExcerpt ?? r.srcExcerpt ?? null,
      category:     r.category ?? null,
      displayOrder: r.displayOrder ?? 99,
      heroImage:    r.heroImage ?? null,
    }));
  } catch {
    return [];
  }
}
