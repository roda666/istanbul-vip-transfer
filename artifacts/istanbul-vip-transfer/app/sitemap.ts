import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site-config';
import { blogPosts, getAllSlugs as getBlogSlugs } from '@/lib/blog-data';

const BASE = SITE.siteUrl;

/**
 * Non-service static slugs always included in the sitemap.
 */
const STATIC_SLUGS: { slug: string; priority: number }[] = [
  { slug: 'hizmetler',  priority: 0.8  },
  { slug: 'araclar',    priority: 0.7  },
  { slug: 'hakkimizda', priority: 0.6  },
  { slug: 'iletisim',   priority: 0.6  },
];

/**
 * Fallback service slugs (used when DB is unavailable).
 * The live sitemap query replaces this with the DB list.
 */
const FALLBACK_SERVICE_SLUGS: { slug: string; priority: number }[] = [
  { slug: 'istanbul-havalimani-transfer',       priority: 0.9  },
  { slug: 'sabiha-gokcen-havalimani-transfer',  priority: 0.9  },
  { slug: 'vip-transfer',                       priority: 0.8  },
  { slug: 'sehirler-arasi-transfer',            priority: 0.8  },
  { slug: 'soforlu-arac-kiralama',              priority: 0.75 },
  { slug: 'otel-transfer',                      priority: 0.75 },
  { slug: 'saglik-turizmi-transfer',            priority: 0.75 },
  { slug: 'kurumsal-vip-transfer',              priority: 0.75 },
];

/**
 * Dynamic sitemap — regenerated on every request (Next.js revalidates via ISR).
 *
 * Coverage:
 *  1. TR homepage + non-TR homepage aliases (/en, /de, /ru, /ar)
 *  2. TR static service & info pages (12 indexed slugs)
 *  3. Locale-prefixed versions of the same 12 slugs for every non-TR public lang
 *  4. TR blog index + all static Turkish blog articles
 *  5. DB-driven: published blog translations → locale blog index + article URLs
 *
 * Language source of truth: the `languages` table (is_enabled + isPublished flags).
 * Only the 5 publicly visible languages (tr, en, de, ru, ar) ever appear here;
 * passive catalog entries are filtered out automatically.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const now = new Date();

  // ── 1. Resolve active public language set ────────────────────────────────
  const { getPublicLanguages } = await import('@/lib/i18n/active-locales');
  const publicLangs = await getPublicLanguages();          // tr, en, de, ru, ar
  const publicCodes = new Set(publicLangs.map((l) => l.code));
  const nonTrLangs  = publicLangs.filter((l) => l.code !== 'tr');

  // ── 2. Homepages ──────────────────────────────────────────────────────────
  entries.push({
    url: BASE,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 1,
  });
  for (const lang of nonTrLangs) {
    entries.push({
      url: `${BASE}/${lang.code}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.85,
    });
  }

  // ── 3. Static (non-service) info pages ───────────────────────────────────
  for (const { slug, priority } of STATIC_SLUGS) {
    entries.push({ url: `${BASE}/${slug}`, lastModified: now, changeFrequency: 'monthly', priority });
  }
  for (const lang of nonTrLangs) {
    for (const { slug, priority } of STATIC_SLUGS) {
      entries.push({ url: `${BASE}/${lang.code}/${slug}`, lastModified: now, changeFrequency: 'monthly', priority: Math.max(priority - 0.05, 0.5) });
    }
  }

  // ── 4. DB-driven service pages (active + indexable) ───────────────────────
  let serviceSlugList: { slug: string; priority: number; updatedAt?: Date }[] = [];
  try {
    const { db }       = await import('@/db');
    const { content }  = await import('@/db/schema');
    const { eq, and }  = await import('drizzle-orm');

    const rows = await db
      .select({ slug: content.slug, displayOrder: content.displayOrder, updatedAt: content.updatedAt })
      .from(content)
      .where(and(
        eq(content.contentType, 'SERVICE'),
        eq(content.status,      'PUBLISHED'),
        eq(content.indexable,   true),
        eq(content.isActive,    true),
      ));

    // Priority based on display_order: first 4 get 0.9/0.8, rest 0.75
    serviceSlugList = rows
      .sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99))
      .map((r, i) => ({
        slug:      r.slug,
        priority:  i < 2 ? 0.9 : i < 4 ? 0.8 : 0.75,
        updatedAt: r.updatedAt,
      }));
  } catch {
    // DB unavailable — use static fallback list
    serviceSlugList = FALLBACK_SERVICE_SLUGS;
  }

  for (const { slug, priority, updatedAt } of serviceSlugList) {
    // TR root
    entries.push({ url: `${BASE}/${slug}`, lastModified: updatedAt ?? now, changeFrequency: 'monthly', priority });
    // Locale prefixes
    for (const lang of nonTrLangs) {
      entries.push({ url: `${BASE}/${lang.code}/${slug}`, lastModified: updatedAt ?? now, changeFrequency: 'monthly', priority: Math.max(priority - 0.05, 0.5) });
    }
  }

  // ── 5. Turkish blog index + static articles ───────────────────────────────
  const blogSlugs = getBlogSlugs();
  if (blogSlugs.length > 0) {
    entries.push({
      url: `${BASE}/blog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.65,
    });
    for (const post of blogPosts) {
      entries.push({
        url: `${BASE}/blog/${post.slug}`,
        lastModified: post.updatedAt
          ? new Date(post.updatedAt)
          : new Date(post.publishedAt),
        changeFrequency: 'monthly',
        priority: 0.6,
      });
    }
  }

  // ── 6. DB-driven: published BLOG_POST translations ────────────────────────
  // When a translated blog article is published (content_translations where
  // entity_type = 'content' AND status = 'PUBLISHED'), add:
  //  • the translated article URL:  /{lang}/blog/{slug}
  //  • the locale blog index:       /{lang}/blog  (once per lang, if any article exists)
  try {
    const { db }                  = await import('@/db');
    const { contentTranslations, content } = await import('@/db/schema');
    const { eq, and }             = await import('drizzle-orm');

    const rows = await db
      .select({
        targetLanguageCode: contentTranslations.targetLanguageCode,
        slug:               contentTranslations.slug,
        sourceSlug:         content.slug,
        publishedAt:        contentTranslations.publishedAt,
        updatedAt:          contentTranslations.updatedAt,
      })
      .from(contentTranslations)
      .leftJoin(content, eq(contentTranslations.entityId, content.id))
      .where(
        and(
          eq(contentTranslations.status,     'PUBLISHED'),
          eq(contentTranslations.entityType, 'content'),
        ),
      );

    // Collect which non-TR languages have ≥1 published blog translation
    // so we can emit their /lang/blog index exactly once.
    const langsWithBlog = new Set<string>();

    for (const row of rows) {
      const lang = row.targetLanguageCode;
      if (!publicCodes.has(lang)) continue; // guard against passive catalog leaks

      // Use the translated slug when present; fall back to the source content slug.
      const slug = row.slug ?? row.sourceSlug;
      if (!slug) continue;

      langsWithBlog.add(lang);
      entries.push({
        url: `${BASE}/${lang}/blog/${slug}`,
        lastModified: row.publishedAt ?? row.updatedAt ?? now,
        changeFrequency: 'monthly',
        priority: 0.55,
      });
    }

    // Locale blog index pages — only for languages that actually have articles
    for (const lang of nonTrLangs) {
      if (langsWithBlog.has(lang.code)) {
        entries.push({
          url: `${BASE}/${lang.code}/blog`,
          lastModified: now,
          changeFrequency: 'weekly',
          priority: 0.6,
        });
      }
    }
  } catch {
    // DB unavailable (first deploy, migration not yet applied) — skip silently.
    // Static entries above are always emitted regardless.
  }

  return entries;
}
