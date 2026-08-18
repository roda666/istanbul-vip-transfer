/**
 * Server-side utility for reading BLOG_POST CMS content.
 *
 * Turkish source: `content` table (contentType='BLOG_POST', status='PUBLISHED')
 * Non-TR:         `content_translations` (entityType='content', status='PUBLISHED')
 *
 * All functions are safe to call from public page components — they return
 * null/empty rather than throwing on DB errors.
 */
import 'server-only';

/** Entity type used in content_translations rows for blog posts. */
export const BLOG_ENTITY_TYPE = 'content';

// ── Public types ─────────────────────────────────────────────────────────────

export interface PublishedBlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  heroImage: string | null;
  heroImageAlt: string | null;
  category: string | null;
  author: string | null;
  tags: string[];
  readTimeMinutes: number | null;
  publishedAt: Date | null;
  updatedAt: Date;
  seoTitle: string | null;
  seoDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  canonicalUrl: string | null;
}

export interface PublishedBlogTranslation {
  id: string;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  body: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  publishedAt: Date | null;
  sourceSlug: string;
  sourceTitle: string;
  sourceHeroImage: string | null;
  sourceHeroImageAlt: string | null;
  sourceCategory: string | null;
  sourceAuthor: string | null;
  sourceTags: string[];
}

// ── Published blog listing (TR) ────────────────────────────────────────────────

/**
 * Returns all PUBLISHED blog posts for the TR listing page, ordered by
 * publishedAt desc. Falls back to [] on DB error.
 */
export async function getPublishedBlogPosts(): Promise<PublishedBlogPost[]> {
  try {
    const { db }      = await import('@/db');
    const { content } = await import('@/db/schema');
    const { eq, and, desc } = await import('drizzle-orm');

    const rows = await db
      .select()
      .from(content)
      .where(and(
        eq(content.contentType, 'BLOG_POST'),
        eq(content.status,      'PUBLISHED'),
        eq(content.isActive,    true),
      ))
      .orderBy(desc(content.publishedAt));

    return rows.map(r => ({
      id:             r.id,
      slug:           r.slug,
      title:          r.title,
      excerpt:        r.excerpt ?? null,
      body:           r.body ?? null,
      heroImage:      r.heroImage ?? null,
      heroImageAlt:   r.heroImageAlt ?? null,
      category:       r.category ?? null,
      author:         r.author ?? null,
      tags:           (r.tags as string[] | null) ?? [],
      readTimeMinutes: r.readTimeMinutes ?? null,
      publishedAt:    r.publishedAt ?? null,
      updatedAt:      r.updatedAt,
      seoTitle:       r.seoTitle ?? null,
      seoDescription: r.seoDescription ?? null,
      ogTitle:        r.ogTitle ?? null,
      ogDescription:  r.ogDescription ?? null,
      canonicalUrl:   r.canonicalUrl ?? null,
    }));
  } catch {
    return [];
  }
}

// ── Single blog post (TR) ──────────────────────────────────────────────────────

/**
 * Returns a single PUBLISHED blog post by slug. Returns null if not found,
 * not published, or DB is unavailable.
 */
export async function getPublishedBlogPost(slug: string): Promise<PublishedBlogPost | null> {
  try {
    const { db }      = await import('@/db');
    const { content } = await import('@/db/schema');
    const { eq, and } = await import('drizzle-orm');

    const [row] = await db
      .select()
      .from(content)
      .where(and(
        eq(content.slug,        slug),
        eq(content.contentType, 'BLOG_POST'),
        eq(content.status,      'PUBLISHED'),
        eq(content.isActive,    true),
      ))
      .limit(1);

    if (!row) return null;

    return {
      id:             row.id,
      slug:           row.slug,
      title:          row.title,
      excerpt:        row.excerpt ?? null,
      body:           row.body ?? null,
      heroImage:      row.heroImage ?? null,
      heroImageAlt:   row.heroImageAlt ?? null,
      category:       row.category ?? null,
      author:         row.author ?? null,
      tags:           (row.tags as string[] | null) ?? [],
      readTimeMinutes: row.readTimeMinutes ?? null,
      publishedAt:    row.publishedAt ?? null,
      updatedAt:      row.updatedAt,
      seoTitle:       row.seoTitle ?? null,
      seoDescription: row.seoDescription ?? null,
      ogTitle:        row.ogTitle ?? null,
      ogDescription:  row.ogDescription ?? null,
      canonicalUrl:   row.canonicalUrl ?? null,
    };
  } catch {
    return null;
  }
}

// ── Non-TR translation ─────────────────────────────────────────────────────────

/**
 * Returns a published translation for a given slug (translated or source) and lang.
 * Tries translated slug first, then falls back to source content slug.
 */
export async function getPublishedBlogTranslation(
  slug: string,
  lang: string,
): Promise<PublishedBlogTranslation | null> {
  try {
    const { db }                          = await import('@/db');
    const { contentTranslations, content } = await import('@/db/schema');
    const { eq, and, or, sql }            = await import('drizzle-orm');

    const rows = await db
      .select({
        id:              contentTranslations.id,
        title:           contentTranslations.title,
        slug:            contentTranslations.slug,
        excerpt:         contentTranslations.excerpt,
        body:            contentTranslations.body,
        metaTitle:       contentTranslations.metaTitle,
        metaDescription: contentTranslations.metaDescription,
        publishedAt:     contentTranslations.publishedAt,
        sourceSlug:      content.slug,
        sourceTitle:     content.title,
        sourceHeroImage: content.heroImage,
        sourceHeroImageAlt: content.heroImageAlt,
        sourceCategory:  content.category,
        sourceAuthor:    content.author,
        sourceTags:      content.tags,
      })
      .from(contentTranslations)
      // entity_id is TEXT, content.id is UUID — explicit cast required
      .innerJoin(content, sql`${contentTranslations.entityId}::uuid = ${content.id}`)
      .where(and(
        eq(contentTranslations.targetLanguageCode, lang),
        eq(contentTranslations.status,             'PUBLISHED'),
        eq(contentTranslations.entityType,         BLOG_ENTITY_TYPE),
        eq(content.contentType,                    'BLOG_POST'),
        eq(content.status,                         'PUBLISHED'),
        or(
          eq(contentTranslations.slug, slug),
          eq(content.slug,             slug),
        ),
      ))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      id:               row.id,
      title:            row.title,
      slug:             row.slug,
      excerpt:          row.excerpt,
      body:             row.body,
      metaTitle:        row.metaTitle,
      metaDescription:  row.metaDescription,
      publishedAt:      row.publishedAt,
      sourceSlug:       row.sourceSlug,
      sourceTitle:      row.sourceTitle,
      sourceHeroImage:  row.sourceHeroImage,
      sourceHeroImageAlt: row.sourceHeroImageAlt,
      sourceCategory:   row.sourceCategory,
      sourceAuthor:     row.sourceAuthor,
      sourceTags:       (row.sourceTags as string[] | null) ?? [],
    };
  } catch {
    return null;
  }
}

// ── Published translations listing (non-TR) ────────────────────────────────────

export interface TranslatedBlogListItem {
  id: string;
  slug: string | null;
  title: string | null;
  excerpt: string | null;
  publishedAt: Date | null;
  sourceSlug: string;
  sourceHeroImage: string | null;
  sourceHeroImageAlt: string | null;
  sourceCategory: string | null;
}

export async function getPublishedBlogTranslations(
  lang: string,
): Promise<TranslatedBlogListItem[]> {
  try {
    const { db }                          = await import('@/db');
    const { contentTranslations, content } = await import('@/db/schema');
    const { eq, and, desc, sql }          = await import('drizzle-orm');

    const rows = await db
      .select({
        id:              contentTranslations.id,
        slug:            contentTranslations.slug,
        title:           contentTranslations.title,
        excerpt:         contentTranslations.excerpt,
        publishedAt:     contentTranslations.publishedAt,
        sourceSlug:      content.slug,
        sourceHeroImage: content.heroImage,
        sourceHeroImageAlt: content.heroImageAlt,
        sourceCategory:  content.category,
      })
      .from(contentTranslations)
      // entity_id is TEXT, content.id is UUID — explicit cast required
      .innerJoin(content, sql`${contentTranslations.entityId}::uuid = ${content.id}`)
      .where(and(
        eq(contentTranslations.targetLanguageCode, lang),
        eq(contentTranslations.status,             'PUBLISHED'),
        eq(contentTranslations.entityType,         BLOG_ENTITY_TYPE),
        eq(content.contentType,                    'BLOG_POST'),
        eq(content.status,                         'PUBLISHED'),
      ))
      .orderBy(desc(contentTranslations.publishedAt));

    return rows;
  } catch {
    return [];
  }
}

// ── Language availability ──────────────────────────────────────────────────────

/**
 * Returns language codes that have a PUBLISHED version of this blog post.
 * 'tr' is always included when the source is published.
 * Falls back to ['tr'] on DB error.
 */
export async function getPublishedBlogLangs(slug: string): Promise<string[]> {
  try {
    const { db }                          = await import('@/db');
    const { content, contentTranslations } = await import('@/db/schema');
    const { eq, and }                     = await import('drizzle-orm');

    const [src] = await db
      .select({ id: content.id, status: content.status, isActive: content.isActive })
      .from(content)
      .where(and(eq(content.slug, slug), eq(content.contentType, 'BLOG_POST')))
      .limit(1);

    if (!src || !src.isActive || src.status !== 'PUBLISHED') return [];

    const txRows = await db
      .select({ lang: contentTranslations.targetLanguageCode })
      .from(contentTranslations)
      .where(and(
        eq(contentTranslations.entityType, BLOG_ENTITY_TYPE),
        eq(contentTranslations.entityId,   src.id),
        eq(contentTranslations.status,     'PUBLISHED'),
      ));

    return ['tr', ...txRows.map(r => r.lang)];
  } catch {
    return ['tr'];
  }
}

// ── All published slugs (for generateStaticParams / health check) ─────────────

export async function getPublishedBlogSlugs(): Promise<string[]> {
  try {
    const { db }      = await import('@/db');
    const { content } = await import('@/db/schema');
    const { eq, and } = await import('drizzle-orm');

    const rows = await db
      .select({ slug: content.slug })
      .from(content)
      .where(and(
        eq(content.contentType, 'BLOG_POST'),
        eq(content.status,      'PUBLISHED'),
        eq(content.isActive,    true),
      ));

    return rows.map(r => r.slug);
  } catch {
    return [];
  }
}

// ── Admin: full record with translations + revisions ──────────────────────────

export interface BlogAdminTranslation {
  id: string | null;
  locale: string;
  status: string;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  body: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  imageAlt: string | null;
  sourceHash: string | null;
  isManuallyLocked: boolean;
  isAiGenerated: boolean;
  publishedAt: string | null;
  failureReason: string | null;
  updatedAt: string | null;
}

export interface BlogAdminRevision {
  id: string;
  snapshot: Record<string, unknown>;
  changedBy: string | null;
  createdAt: string;
}

export interface BlogAdminRecord {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  heroImage: string | null;
  heroImageAlt: string | null;
  ogImage: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  indexable: boolean;
  isActive: boolean;
  category: string | null;
  author: string | null;
  tags: string[];
  readTimeMinutes: number | null;
  ogTitle: string | null;
  ogDescription: string | null;
  status: string;
  publishedAt: string | null;
  scheduledAt: string | null;
  updatedAt: string;
  translations: BlogAdminTranslation[];
  revisions: BlogAdminRevision[];
}

export async function getBlogAdminRecord(id: string): Promise<BlogAdminRecord> {
  const { db }                                  = await import('@/db');
  const { content, contentTranslations, blogRevisions, languages } = await import('@/db/schema');
  const { eq, and, desc }                       = await import('drizzle-orm');

  const [row] = await db
    .select()
    .from(content)
    .where(and(eq(content.id, id), eq(content.contentType, 'BLOG_POST')))
    .limit(1);

  if (!row) throw new Error('Not found');

  // All enabled non-TR languages
  const langs = await db
    .select({ code: languages.code })
    .from(languages)
    .where(eq(languages.isEnabled, true));
  const targetLangs = langs.map(l => l.code).filter(c => c !== 'tr');

  // Fetch translations
  const txRows = await db
    .select()
    .from(contentTranslations)
    .where(and(
      eq(contentTranslations.entityType, BLOG_ENTITY_TYPE),
      eq(contentTranslations.entityId,   id),
    ));
  const txByLang = new Map(txRows.map(tx => [tx.targetLanguageCode, tx]));

  const translations: BlogAdminTranslation[] = targetLangs.map(locale => {
    const tx = txByLang.get(locale);
    return {
      id:               tx?.id ?? null,
      locale,
      status:           tx?.status ?? 'NOT_STARTED',
      title:            tx?.title ?? null,
      slug:             tx?.slug ?? null,
      excerpt:          tx?.excerpt ?? null,
      body:             tx?.body ?? null,
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

  // Fetch last 20 revisions
  const revRows = await db
    .select()
    .from(blogRevisions)
    .where(eq(blogRevisions.contentId, id))
    .orderBy(desc(blogRevisions.createdAt))
    .limit(20);

  const revisions: BlogAdminRevision[] = revRows.map(r => ({
    id:        r.id,
    snapshot:  r.snapshot as Record<string, unknown>,
    changedBy: r.changedBy ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  return {
    id:             row.id,
    slug:           row.slug,
    title:          row.title,
    excerpt:        row.excerpt ?? null,
    body:           row.body ?? null,
    heroImage:      row.heroImage ?? null,
    heroImageAlt:   row.heroImageAlt ?? null,
    ogImage:        row.ogImage ?? null,
    seoTitle:       row.seoTitle ?? null,
    seoDescription: row.seoDescription ?? null,
    canonicalUrl:   row.canonicalUrl ?? null,
    indexable:      row.indexable,
    isActive:       row.isActive,
    category:       row.category ?? null,
    author:         row.author ?? null,
    tags:           (row.tags as string[] | null) ?? [],
    readTimeMinutes: row.readTimeMinutes ?? null,
    ogTitle:        row.ogTitle ?? null,
    ogDescription:  row.ogDescription ?? null,
    status:         row.status,
    publishedAt:    row.publishedAt?.toISOString() ?? null,
    scheduledAt:    row.scheduledAt?.toISOString() ?? null,
    updatedAt:      row.updatedAt.toISOString(),
    translations,
    revisions,
  };
}
