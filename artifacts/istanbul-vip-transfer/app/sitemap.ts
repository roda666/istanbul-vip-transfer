import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site-config';
import { localizedServicePath } from '@/lib/localized-service-path';

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
 * All publicly visible languages (tr, en, de, ru, ar, es, fr, it, nl) appear here;
 * passive catalog entries are filtered out automatically.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // Tracks emitted URLs so we never emit the same URL twice.
  const seen = new Set<string>();
  function push(entry: MetadataRoute.Sitemap[number]) {
    if (seen.has(entry.url)) return;
    seen.add(entry.url);
    entries.push(entry);
  }

  // ── 1. Resolve active public language set ────────────────────────────────
  const { getPublicLanguages } = await import('@/lib/i18n/active-locales');
  const publicLangs = await getPublicLanguages();          // tr, en, de, ru, ar, es, fr, it, nl
  const publicCodes = new Set(publicLangs.map((l) => l.code));
  const nonTrLangs  = publicLangs.filter((l) => l.code !== 'tr');

  // ── 2. Homepages ──────────────────────────────────────────────────────────
  // No lastModified — there is no real updatedAt for the root route.
  push({
    url: BASE,
    changeFrequency: 'weekly',
    priority: 1,
  });
  for (const lang of nonTrLangs) {
    push({
      url: `${BASE}/${lang.code}`,
      changeFrequency: 'weekly',
      priority: 0.85,
    });
  }

  // ── 3. Static (non-service) info pages ───────────────────────────────────
  // No lastModified — these pages have no real updatedAt.
  for (const { slug, priority } of STATIC_SLUGS) {
    push({ url: `${BASE}/${slug}`, changeFrequency: 'monthly', priority });
  }
  for (const lang of nonTrLangs) {
    for (const { slug, priority } of STATIC_SLUGS) {
      push({ url: `${BASE}/${lang.code}/${slug}`, changeFrequency: 'monthly', priority: Math.max(priority - 0.05, 0.5) });
    }
  }

  // ── 4. DB-driven service pages — only emit locale URLs for PUBLISHED translations ──
  //
  // Design: Turkish root URL is always emitted for each published, active, indexable
  // service page.  Non-TR locale URLs are only emitted when a PUBLISHED translation
  // exists in content_translations (OUTDATED and DRAFT are intentionally excluded to
  // avoid indexing pages that may show stale or unsatisfactory content).
  //
  // On DB failure we skip all service locale URLs (conservative: avoids indexing
  // pages whose translation state we cannot verify).

  let serviceSlugList: { slug: string; id: string; priority: number; updatedAt?: Date }[] = [];
  // Map of content ID → Map of locale → published translation updatedAt
  let publishedTxByContent = new Map<string, Map<string, Date | undefined>>();
  // Map of content ID → slug (for joining)
  const idToSlug = new Map<string, string>();

  try {
    const { db }                             = await import('@/db');
    const { content, contentTranslations }   = await import('@/db/schema');
    const { eq, and, inArray }               = await import('drizzle-orm');

    const rows = await db
      .select({ id: content.id, slug: content.slug, displayOrder: content.displayOrder, updatedAt: content.updatedAt })
      .from(content)
      .where(and(
        eq(content.contentType, 'SERVICE'),
        eq(content.status,      'PUBLISHED'),
        eq(content.indexable,   true),
        eq(content.isActive,    true),
      ));

    serviceSlugList = rows
      .sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99))
      .map((r, i) => ({
        id:        r.id,
        slug:      r.slug,
        priority:  i < 2 ? 0.9 : i < 4 ? 0.8 : 0.75,
        updatedAt: r.updatedAt,
      }));

    for (const r of serviceSlugList) idToSlug.set(r.id, r.slug);

    // Fetch all PUBLISHED or OUTDATED service translations in one query.
    // OUTDATED means was previously published; the old content remains live until
    // a new translation is approved and published. Exclude from sitemap only if
    // the content has never been published (DRAFT/REVIEW/FAILED/NOT_STARTED).
    if (serviceSlugList.length > 0) {
      const txRows = await db
        .select({
          entityId:           contentTranslations.entityId,
          targetLanguageCode: contentTranslations.targetLanguageCode,
          updatedAt:          contentTranslations.updatedAt,
        })
        .from(contentTranslations)
        .where(and(
          eq(contentTranslations.entityType, 'service_page'),
          inArray(contentTranslations.status, ['PUBLISHED', 'OUTDATED']),
        ));

      for (const tx of txRows) {
        if (!idToSlug.has(tx.entityId)) continue; // skip non-indexable / archived sources
        if (!publicCodes.has(tx.targetLanguageCode)) continue; // guard passive locales
        if (!publishedTxByContent.has(tx.entityId)) publishedTxByContent.set(tx.entityId, new Map());
        publishedTxByContent.get(tx.entityId)!.set(tx.targetLanguageCode, tx.updatedAt ?? undefined);
      }
    }
  } catch {
    // DB unavailable — fall back to static slug list; skip locale URLs (cannot verify)
    serviceSlugList = FALLBACK_SERVICE_SLUGS.map((s) => ({ ...s, id: '' }));
    publishedTxByContent = new Map(); // empty → no locale URLs emitted in fallback
  }

  for (const { id, slug, priority, updatedAt } of serviceSlugList) {
    // TR root — always emitted (no translation needed)
    push({ url: `${BASE}/${slug}`, ...(updatedAt ? { lastModified: updatedAt } : {}), changeFrequency: 'monthly', priority });

    // Non-TR: only emit when a PUBLISHED translation exists for this lang
    const txLocales = publishedTxByContent.get(id);
    for (const lang of nonTrLangs) {
      if (!txLocales?.has(lang.code)) continue; // skip — no published translation
      const txUpdatedAt = txLocales.get(lang.code) ?? updatedAt;
      push({
        url: `${BASE}${localizedServicePath(slug, lang.code)}`,
        ...(txUpdatedAt ? { lastModified: txUpdatedAt } : {}),
        changeFrequency: 'monthly',
        priority: Math.max(priority - 0.05, 0.5),
      });
    }
  }

  // ── 5. DB-driven Turkish blog posts ──────────────────────────────────────
  try {
    const { getPublishedBlogPosts } = await import('@/lib/blog-cms');
    const dbBlogPosts = await getPublishedBlogPosts();
    if (dbBlogPosts.length > 0) {
      push({ url: `${BASE}/blog`, changeFrequency: 'weekly', priority: 0.65 });
      for (const post of dbBlogPosts) {
        push({
          url: `${BASE}/blog/${post.slug}`,
          lastModified: post.updatedAt,
          changeFrequency: 'monthly',
          priority: 0.6,
        });
      }
    }
  } catch {
    // DB unavailable — omit TR blog entries from sitemap
  }

  // ── 6. DB-driven: published BLOG_POST translations ────────────────────────
  // Only BLOG_POST source content that is itself PUBLISHED generates translated
  // blog URLs.  Service/Page translations must never appear under /lang/blog/.
  try {
    const { db }                  = await import('@/db');
    const { contentTranslations, content } = await import('@/db/schema');
    const { eq, and, sql }        = await import('drizzle-orm');

    const rows = await db
      .select({
        targetLanguageCode: contentTranslations.targetLanguageCode,
        slug:               contentTranslations.slug,
        sourceSlug:         content.slug,
        publishedAt:        contentTranslations.publishedAt,
        updatedAt:          contentTranslations.updatedAt,
      })
      .from(contentTranslations)
      // innerJoin ensures the source content row exists; leftJoin would allow
      // orphaned translations to generate URLs with null sourceSlug.
      // entity_id is TEXT, content.id is UUID — explicit cast required.
      .innerJoin(content, sql`${contentTranslations.entityId}::uuid = ${content.id}`)
      .where(
        and(
          eq(contentTranslations.status,     'PUBLISHED'),
          eq(contentTranslations.entityType, 'content'),
          // Only original blog posts — never service or static page translations.
          eq(content.contentType, 'BLOG_POST'),
          // Source must itself be published (no drafts leaking through).
          eq(content.status, 'PUBLISHED'),
        ),
      );

    // Collect which non-TR languages have ≥1 published blog translation
    // so we can emit their /lang/blog index exactly once.
    const langsWithBlog = new Set<string>();

    for (const row of rows) {
      const lang = row.targetLanguageCode;
      // No /tr/blog/… URLs — TR is served at /blog/…
      if (lang === 'tr') continue;
      if (!publicCodes.has(lang)) continue; // guard against passive catalog leaks

      // Use the translated slug when present; fall back to the source content slug.
      const slug = row.slug ?? row.sourceSlug;
      if (!slug) continue;

      langsWithBlog.add(lang);
      push({
        url: `${BASE}/${lang}/blog/${slug}`,
        // Use real timestamps — no new Date() fallback for dynamic content.
        ...(row.publishedAt || row.updatedAt
          ? { lastModified: row.publishedAt ?? row.updatedAt! }
          : {}),
        changeFrequency: 'monthly',
        priority: 0.55,
      });
    }

    // Locale blog index pages — no lastModified (no reliable updatedAt).
    for (const lang of nonTrLangs) {
      if (langsWithBlog.has(lang.code)) {
        push({
          url: `${BASE}/${lang.code}/blog`,
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
