/**
 * Blog-specific hreflang builder.
 *
 * Unlike the generic buildAlternates helper (which assumes every language's URL
 * shares the same path suffix), blog articles can have language-specific slugs
 * stored in contentTranslations.slug. This helper queries the DB to resolve
 * each language's actual published slug before constructing hreflang entries.
 *
 * Usage:
 *   // Turkish source article page (/blog/[slug])
 *   const { trCanonical, languages } = await buildBlogAlternates(post.slug);
 *   return { alternates: { canonical: trCanonical, languages }, ... };
 *
 *   // Localized article page (/[lang]/blog/[slug])
 *   const { trCanonical, languages } = await buildBlogAlternates(translation.sourceSlug);
 *   const selfCanonical = `${SITE.siteUrl}/${lang}/blog/${translation.slug ?? slug}`;
 *   return { alternates: { canonical: selfCanonical, languages }, ... };
 */
import 'server-only';
import { SITE } from '@/lib/site-config';
import { LANG_LOCALES } from '@/lib/i18n';
import { getPublicLanguages } from '@/lib/i18n/active-locales';

export interface BlogAlternatesResult {
  /** Canonical URL for the Turkish (source) version of this article. */
  trCanonical: string;
  /**
   * hreflang languages map suitable for Next.js metadata.alternates.languages.
   * Always includes x-default and tr-TR pointing to the Turkish canonical.
   * Includes an entry for each language that has a PUBLISHED translation;
   * languages without a published translation are intentionally omitted.
   */
  languages: Record<string, string>;
}

/**
 * Builds correct hreflang alternates for a blog article by resolving each
 * public language's actual published translation slug from the database.
 *
 * Falls back gracefully when the DB is unavailable or the source article is
 * not found — in that case only the Turkish self-referential entries are
 * included, which is correct (no broken alternates).
 *
 * @param sourceSlug - The slug of the Turkish source article (content.slug).
 */
export async function buildBlogAlternates(sourceSlug: string): Promise<BlogAlternatesResult> {
  const base = SITE.siteUrl;
  const trCanonical = `${base}/blog/${sourceSlug}`;

  const languages: Record<string, string> = {
    'x-default': trCanonical,
    [LANG_LOCALES.tr]: trCanonical,
  };

  try {
    const { db } = await import('@/db');
    const { content, contentTranslations } = await import('@/db/schema');
    const { eq, and } = await import('drizzle-orm');

    // Locate the source content record by its Turkish slug
    const [source] = await db
      .select({ id: content.id })
      .from(content)
      .where(and(eq(content.slug, sourceSlug), eq(content.contentType, 'BLOG_POST')))
      .limit(1);

    if (source) {
      // Fetch every published translation for this article
      const translations = await db
        .select({
          lang: contentTranslations.targetLanguageCode,
          slug: contentTranslations.slug,
        })
        .from(contentTranslations)
        .where(
          and(
            eq(contentTranslations.entityId, source.id),
            eq(contentTranslations.status, 'PUBLISHED'),
          ),
        );

      // lang code → actual translated slug (fallback: source slug)
      const slugByLang = new Map(
        translations.map((r) => [r.lang, r.slug ?? sourceSlug]),
      );

      // Only emit hreflang for publicly active languages that have a translation
      const publicLangs = await getPublicLanguages();
      for (const lang of publicLangs) {
        if (lang.code === 'tr') continue; // Turkish already set above
        const tSlug = slugByLang.get(lang.code);
        if (!tSlug) continue; // No published translation → omit (correct SEO)
        languages[lang.locale] = `${base}/${lang.code}/blog/${tSlug}`;
      }
    }
  } catch {
    // DB unavailable — only Turkish entries are present; no broken alternates
  }

  return { trCanonical, languages };
}
