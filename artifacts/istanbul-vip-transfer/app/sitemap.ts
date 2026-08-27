import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site-config';
import { LANG_LOCALES } from '@/lib/i18n';
import {
  localizedServiceCategoryPath,
  localizedServicePath,
  localizedStaticPath,
  localizedTransferRoutePath,
} from '@/lib/localized-service-path';

const BASE = SITE.siteUrl;

// Service/category publication changes must be reflected immediately.
export const dynamic = 'force-dynamic';

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
      push({ url: `${BASE}${localizedStaticPath(slug, lang.code)}`, changeFrequency: 'monthly', priority: Math.max(priority - 0.05, 0.5) });
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

  // ── 4b. Active service category pages ──────────────────────────────────────
  // Categories are public browse pages with locale-aware labels. They are
  // therefore indexed alongside the services they group.
  try {
    const { getServiceCategories } = await import('@/lib/service-category-server');
    const categories = await getServiceCategories('tr');
    for (const category of categories) {
      push({
        url: `${BASE}${localizedServiceCategoryPath(category.slug, 'tr')}`,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
      for (const lang of nonTrLangs) {
        push({
          url: `${BASE}${localizedServiceCategoryPath(category.slug, lang.code)}`,
          changeFrequency: 'weekly',
          priority: 0.65,
        });
      }
    }
  } catch {
    // Category URLs are omitted if the catalog cannot be verified.
  }

  // ── 5. Transfer-route detail pages ───────────────────────────────────────
  // Active, indexable Turkish routes are emitted. Locale routes require an
  // explicit PUBLISHED route translation; no Turkish fallback can enter SEO.
  try {
    const { db } = await import('@/db');
    const { transferRoutes, transferRouteTranslations } = await import('@/db/schema');
    const { and, eq, inArray } = await import('drizzle-orm');
    const routes = await db.select({
      id: transferRoutes.id,
      slug: transferRoutes.slug,
      updatedAt: transferRoutes.updatedAt,
    }).from(transferRoutes).where(and(
      eq(transferRoutes.active, true),
      eq(transferRoutes.indexable, true),
    ));

    if (routes.length > 0) {
      const routeIds = routes.map((route) => route.id);
      const translations = await db.select({
        routeId: transferRouteTranslations.routeId,
        languageCode: transferRouteTranslations.languageCode,
        updatedAt: transferRouteTranslations.updatedAt,
      }).from(transferRouteTranslations).where(and(
        inArray(transferRouteTranslations.routeId, routeIds),
        eq(transferRouteTranslations.status, 'PUBLISHED'),
      ));
      const publishedByRoute = new Map<string, Map<string, Date | undefined>>();
      for (const translation of translations) {
        if (!publicCodes.has(translation.languageCode)) continue;
        const locales = publishedByRoute.get(translation.routeId) ?? new Map();
        locales.set(translation.languageCode, translation.updatedAt ?? undefined);
        publishedByRoute.set(translation.routeId, locales);
      }
      for (const route of routes) {
        push({
          url: `${BASE}${localizedTransferRoutePath(route.slug, 'tr')}`,
          ...(route.updatedAt ? { lastModified: route.updatedAt } : {}),
          changeFrequency: 'monthly',
          priority: 0.7,
        });
        const locales = publishedByRoute.get(route.id);
        for (const lang of nonTrLangs) {
          const translatedAt = locales?.get(lang.code);
          if (!translatedAt) continue;
          push({
            url: `${BASE}${localizedTransferRoutePath(route.slug, lang.code)}`,
            lastModified: translatedAt,
            changeFrequency: 'monthly',
            priority: 0.65,
          });
        }
      }
    }
  } catch {
    // A database issue must never cause unverified route locales to be indexed.
  }

  // ── 6 & 7. DB-driven blog posts (TR + published translations) ───────────
  // Only BLOG_POST source content that is itself PUBLISHED generates blog URLs.
  // Service/Page translations must never appear under /blog/ or /lang/blog/.
  // Each URL (TR and every translation) carries an <xhtml:link rel="alternate">
  // hreflang set built from every PUBLISHED translation of that same article,
  // so crawlers can discover every language variant directly from any one entry.
  try {
    const { db }                            = await import('@/db');
    const { content, contentTranslations }  = await import('@/db/schema');
    const { eq, and, inArray }              = await import('drizzle-orm');

    const posts = await db
      .select({ id: content.id, slug: content.slug, updatedAt: content.updatedAt })
      .from(content)
      .where(and(
        eq(content.contentType, 'BLOG_POST'),
        eq(content.status,      'PUBLISHED'),
        eq(content.isActive,    true),
      ));

    if (posts.length > 0) {
      const postIds = posts.map((p) => p.id);

      const txRows = await db
        .select({
          entityId:           contentTranslations.entityId,
          targetLanguageCode: contentTranslations.targetLanguageCode,
          slug:               contentTranslations.slug,
          publishedAt:        contentTranslations.publishedAt,
          updatedAt:          contentTranslations.updatedAt,
        })
        .from(contentTranslations)
        .where(and(
          eq(contentTranslations.entityType, 'content'),
          eq(contentTranslations.status,     'PUBLISHED'),
          inArray(contentTranslations.entityId, postIds),
        ));

      // Map source content ID → Map<lang, translation row>. Passive/unpublished
      // catalog languages are guarded out here, same as the rest of the sitemap.
      const txByPost = new Map<string, Map<string, (typeof txRows)[number]>>();
      for (const tx of txRows) {
        if (!publicCodes.has(tx.targetLanguageCode)) continue;
        if (!txByPost.has(tx.entityId)) txByPost.set(tx.entityId, new Map());
        txByPost.get(tx.entityId)!.set(tx.targetLanguageCode, tx);
      }

      push({ url: `${BASE}/blog`, changeFrequency: 'weekly', priority: 0.65 });

      // Collect which non-TR languages have ≥1 published blog translation
      // so we can emit their /lang/blog index exactly once.
      const langsWithBlog = new Set<string>();

      for (const post of posts) {
        const trUrl     = `${BASE}/blog/${post.slug}`;
        const txLocales = txByPost.get(post.id);

        // hreflang set shared by the TR entry and every translated entry of
        // this same article — x-default + tr-TR always point at the TR URL.
        const languages: Record<string, string> = {
          'x-default':      trUrl,
          [LANG_LOCALES.tr]: trUrl,
        };
        if (txLocales) {
          for (const [lang, tx] of txLocales) {
            const slug = tx.slug ?? post.slug;
            languages[LANG_LOCALES[lang as keyof typeof LANG_LOCALES] ?? lang] = `${BASE}/${lang}/blog/${slug}`;
          }
        }

        push({
          url: trUrl,
          lastModified: post.updatedAt,
          changeFrequency: 'monthly',
          priority: 0.6,
          alternates: { languages },
        });

        if (txLocales) {
          for (const [lang, tx] of txLocales) {
            // Use the translated slug when present; fall back to the source slug.
            const slug = tx.slug ?? post.slug;
            langsWithBlog.add(lang);
            push({
              url: `${BASE}/${lang}/blog/${slug}`,
              // Use real timestamps — no new Date() fallback for dynamic content.
              ...(tx.publishedAt || tx.updatedAt
                ? { lastModified: tx.publishedAt ?? tx.updatedAt! }
                : {}),
              changeFrequency: 'monthly',
              priority: 0.55,
              alternates: { languages },
            });
          }
        }
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
    }
  } catch {
    // DB unavailable (first deploy, migration not yet applied) — skip silently.
    // Static entries above are always emitted regardless.
  }

  return entries;
}
