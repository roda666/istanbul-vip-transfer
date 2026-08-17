/**
 * Database helpers for CMS-backed legal/policy pages.
 * content_type = 'PAGE', status = 'PUBLISHED'
 */
import { db } from '@/db';
import { content, contentTranslations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const LEGAL_SLUGS = [
  'kvkk-aydinlatma-metni',
  'cerez-politikasi',
  'kullanim-kosullari',
  'gizlilik-politikasi',
] as const;

export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export function isLegalSlug(slug: string): slug is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(slug);
}

export interface LegalPage {
  id:          string;
  slug:        string;
  title:       string;
  excerpt:     string;
  body:        string;
  updatedAt:   Date;
}

/** Fetch Turkish (source) legal page from the content table. */
export async function getLegalPage(slug: string): Promise<LegalPage | null> {
  try {
    const [row] = await db
      .select({
        id:        content.id,
        slug:      content.slug,
        title:     content.title,
        excerpt:   content.excerpt,
        body:      content.body,
        updatedAt: content.updatedAt,
      })
      .from(content)
      .where(
        and(
          eq(content.slug,        slug),
          eq(content.contentType, 'PAGE'),
          eq(content.status,      'PUBLISHED'),
        ),
      )
      .limit(1);

    if (!row) return null;
    return {
      id:        row.id,
      slug:      row.slug      ?? slug,
      title:     row.title     ?? '',
      excerpt:   row.excerpt   ?? '',
      body:      row.body      ?? '',
      updatedAt: row.updatedAt ?? new Date(),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch translated legal page from content_translations.
 * Returns null if no published translation exists for the given language.
 */
export async function getLegalPageTranslation(
  slug: string,
  lang: string,
): Promise<LegalPage | null> {
  try {
    const [source] = await db
      .select({ id: content.id })
      .from(content)
      .where(
        and(
          eq(content.slug,        slug),
          eq(content.contentType, 'PAGE'),
          eq(content.status,      'PUBLISHED'),
        ),
      )
      .limit(1);

    if (!source) return null;

    const [trans] = await db
      .select({
        slug:      contentTranslations.slug,
        title:     contentTranslations.title,
        excerpt:   contentTranslations.excerpt,
        body:      contentTranslations.body,
        updatedAt: contentTranslations.updatedAt,
      })
      .from(contentTranslations)
      .where(
        and(
          eq(contentTranslations.entityType,         'content'),
          eq(contentTranslations.entityId,           source.id),
          eq(contentTranslations.targetLanguageCode, lang),
          eq(contentTranslations.status,             'PUBLISHED'),
        ),
      )
      .limit(1);

    if (!trans) return null;
    return {
      id:        source.id,
      slug:      trans.slug      ?? slug,
      title:     trans.title     ?? '',
      excerpt:   trans.excerpt   ?? '',
      body:      trans.body      ?? '',
      updatedAt: trans.updatedAt ?? new Date(),
    };
  } catch {
    return null;
  }
}
