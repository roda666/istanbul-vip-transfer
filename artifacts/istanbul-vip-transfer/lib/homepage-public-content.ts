/**
 * Public, server-only readers for homepage content that is managed outside the
 * homepage JSON document. These readers intentionally never call admin APIs.
 */
import 'server-only';

export interface HomepageReview {
  id: string;
  name: string;
  rating: number;
  text: string;
}

export interface HomepageFaq {
  id: string;
  question: string;
  answer: string;
}

export type HomepageServiceCopy = Record<string, {
  title?: string;
  description?: string;
}>;

/**
 * Returns reviews synchronized from the selected Google Business Profile location.
 * Manual/legacy rows are deliberately excluded: public visitors must never see
 * editor-written text presented as a Google review. Google does not translate
 * review text, so the original verified text is shown for every locale.
 */
export async function getPublishedHomepageReviews(locale: string): Promise<HomepageReview[]> {
  void locale;
  try {
    const { db } = await import('@/db');
    const { googleReviews, socialPlatforms } = await import('@/db/schema');
    const { and, asc, desc, eq } = await import('drizzle-orm');

    const [platform] = await db.select({ connectionMeta: socialPlatforms.connectionMeta })
      .from(socialPlatforms)
      .where(and(
        eq(socialPlatforms.key, 'google_business'),
        eq(socialPlatforms.connected, true),
      ))
      .limit(1);
    const locationName = platform?.connectionMeta?.locationName;
    if (typeof locationName !== 'string') return [];

    const rows = await db
      .select({
        id: googleReviews.id,
        name: googleReviews.reviewerName,
        rating: googleReviews.rating,
        text: googleReviews.reviewText,
      })
      .from(googleReviews)
      .where(and(
        eq(googleReviews.isVisible, true),
          eq(googleReviews.source, 'google_business'),
          eq(googleReviews.locationResourceName, locationName),
      ))
      .orderBy(asc(googleReviews.sortOrder), desc(googleReviews.createdAt))
      .limit(3);

    return rows;
  } catch {
    return [];
  }
}

/**
 * Homepage FAQ rows are Turkish source records today. The homepage editor does
 * not own a per-locale FAQ workflow, so localized pages continue to use their
 * localized dictionary fallback rather than silently showing Turkish copy.
 */
export async function getPublishedHomepageFaqs(locale: string): Promise<HomepageFaq[]> {
  if (locale !== 'tr') return [];

  try {
    const { db } = await import('@/db');
    const { content, faqs } = await import('@/db/schema');
    const { and, asc, eq } = await import('drizzle-orm');

    const [homepage] = await db
      .select({ id: content.id })
      .from(content)
      .where(and(eq(content.slug, 'ana-sayfa'), eq(content.status, 'PUBLISHED')))
      .limit(1);

    if (!homepage) return [];

    return db
      .select({ id: faqs.id, question: faqs.question, answer: faqs.answer })
      .from(faqs)
      .where(eq(faqs.contentId, homepage.id))
      .orderBy(asc(faqs.sortOrder));
  } catch {
    return [];
  }
}

/**
 * Service titles and excerpts are edited in the service CMS, not in the
 * homepage editor. Supply only the locale's published copy so visitors never
 * see a Turkish service title inside a non-Turkish homepage.
 */
export async function getPublishedHomepageServiceCopy(locale: string): Promise<HomepageServiceCopy> {
  try {
    const { db } = await import('@/db');
    const { content, contentTranslations } = await import('@/db/schema');
    const { and, eq, inArray } = await import('drizzle-orm');

    const sources = await db
      .select({
        id: content.id,
        slug: content.slug,
        title: content.title,
        excerpt: content.excerpt,
      })
      .from(content)
      .where(and(
        eq(content.contentType, 'SERVICE'),
        eq(content.status, 'PUBLISHED'),
        eq(content.isActive, true),
      ));

    if (locale === 'tr') {
      return Object.fromEntries(sources.map((service) => [
        service.slug,
        { title: service.title, description: service.excerpt ?? undefined },
      ]));
    }

    if (sources.length === 0) return {};

    const translations = await db
      .select({
        entityId: contentTranslations.entityId,
        title: contentTranslations.title,
        excerpt: contentTranslations.excerpt,
      })
      .from(contentTranslations)
      .where(and(
        eq(contentTranslations.entityType, 'service_page'),
        eq(contentTranslations.targetLanguageCode, locale),
        inArray(contentTranslations.status, ['PUBLISHED', 'OUTDATED']),
        inArray(contentTranslations.entityId, sources.map((service) => service.id)),
      ));

    const bySourceId = new Map(translations.map((translation) => [translation.entityId, translation]));
    const copy: HomepageServiceCopy = {};
    for (const service of sources) {
      const translation = bySourceId.get(service.id);
      if (!translation) continue;
      copy[service.slug] = {
        title: translation.title ?? undefined,
        description: translation.excerpt ?? undefined,
      };
    }
    return copy;
  } catch {
    return {};
  }
}