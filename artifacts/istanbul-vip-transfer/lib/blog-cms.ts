/**
 * Server-side utility for reading BLOG_POST CMS content.
 *
 * Turkish source: `content` table (contentType='BLOG_POST', status='PUBLISHED')
 * Non-TR:         completed `content_translations` (entityType='content')
 *
 * All functions are safe to call from public page components — they return
 * null/empty rather than throwing on DB errors.
 */
import 'server-only';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { SUPPORTED_LANGS } from '@/lib/i18n';
import { removeCustomerVisibleTollCopy } from '@/lib/customer-visible-copy';
import { parseMarkdownImage } from '@/lib/blog-markdown';

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

/** Fields rendered in public listing and related-post cards. */
export type PublishedBlogCard = Pick<
  PublishedBlogPost,
  'id' | 'slug' | 'title' | 'excerpt' | 'heroImage' | 'heroImageAlt' |
  'category' | 'author' | 'readTimeMinutes' | 'publishedAt' | 'updatedAt' |
  'seoDescription'
>;

const PUBLIC_BLOG_TAG = 'public-blog';
const BLOG_LIST_LIMIT = 24;
const RELATED_BLOG_LIMIT = 4;

/**
 * Next's data cache may deserialize Date columns as ISO strings between
 * processes. Normalize at the public data boundary so page metadata and date
 * rendering can consistently use Date methods during SSR.
 */
function normalizeOptionalDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeRequiredDate(value: unknown): Date {
  return normalizeOptionalDate(value) ?? new Date(0);
}

/**
 * Image alt text must remain descriptive of the visual, including legitimate
 * geographic terms such as "otoyol". The public toll-copy filter is for route
 * and pricing prose only; applying it here can erase a valid alt altogether.
 */
function normalizeImageAlt(value: string | null): string | null {
  const normalized = value
    ?.replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 200);
  return normalized || null;
}

function normalizeBlogCard(post: PublishedBlogCard): PublishedBlogCard {
  return {
    ...post,
    title: removeCustomerVisibleTollCopy(post.title),
    excerpt: post.excerpt ? removeCustomerVisibleTollCopy(post.excerpt) : null,
    heroImageAlt: normalizeImageAlt(post.heroImageAlt),
    category: post.category ? removeCustomerVisibleTollCopy(post.category) : null,
    author: post.author ? removeCustomerVisibleTollCopy(post.author) : null,
    seoDescription: post.seoDescription ? removeCustomerVisibleTollCopy(post.seoDescription) : null,
    publishedAt: normalizeOptionalDate(post.publishedAt),
    updatedAt: normalizeRequiredDate(post.updatedAt),
  };
}

/**
 * Preserve valid standalone Markdown images before filtering customer-visible
 * route and pricing prose. Visual alt text may accurately mention bridges,
 * roads, or geographic landmarks that the prose filter intentionally removes.
 */
function normalizeBlogBody(value: string): string {
  return value
    .split('\n')
    .map(line => parseMarkdownImage(line) ? line : removeCustomerVisibleTollCopy(line))
    .join('\n');
}

function normalizeBlogPost(post: PublishedBlogPost): PublishedBlogPost {
  return {
    ...post,
    title: removeCustomerVisibleTollCopy(post.title),
    excerpt: post.excerpt ? removeCustomerVisibleTollCopy(post.excerpt) : null,
    body: post.body ? normalizeBlogBody(post.body) : null,
    heroImageAlt: normalizeImageAlt(post.heroImageAlt),
    category: post.category ? removeCustomerVisibleTollCopy(post.category) : null,
    author: post.author ? removeCustomerVisibleTollCopy(post.author) : null,
    tags: post.tags.map(removeCustomerVisibleTollCopy).filter(Boolean),
    seoTitle: post.seoTitle ? removeCustomerVisibleTollCopy(post.seoTitle) : null,
    seoDescription: post.seoDescription ? removeCustomerVisibleTollCopy(post.seoDescription) : null,
    ogTitle: post.ogTitle ? removeCustomerVisibleTollCopy(post.ogTitle) : null,
    ogDescription: post.ogDescription ? removeCustomerVisibleTollCopy(post.ogDescription) : null,
    publishedAt: normalizeOptionalDate(post.publishedAt),
    updatedAt: normalizeRequiredDate(post.updatedAt),
  };
}

function normalizeBlogTranslation(
  translation: PublishedBlogTranslation,
): PublishedBlogTranslation {
  return {
    ...translation,
    title: translation.title ? removeCustomerVisibleTollCopy(translation.title) : null,
    excerpt: translation.excerpt ? removeCustomerVisibleTollCopy(translation.excerpt) : null,
    body: translation.body ? normalizeBlogBody(translation.body) : null,
    metaTitle: translation.metaTitle ? removeCustomerVisibleTollCopy(translation.metaTitle) : null,
    metaDescription: translation.metaDescription
      ? removeCustomerVisibleTollCopy(translation.metaDescription)
      : null,
    sourceTitle: removeCustomerVisibleTollCopy(translation.sourceTitle),
    sourceHeroImageAlt: normalizeImageAlt(translation.sourceHeroImageAlt),
    sourceCategory: translation.sourceCategory
      ? removeCustomerVisibleTollCopy(translation.sourceCategory)
      : null,
    sourceAuthor: translation.sourceAuthor
      ? removeCustomerVisibleTollCopy(translation.sourceAuthor)
      : null,
    sourceTags: translation.sourceTags.map(removeCustomerVisibleTollCopy).filter(Boolean),
    publishedAt: normalizeOptionalDate(translation.publishedAt),
  };
}

const cachedPublishedBlogCards = unstable_cache(
  async (): Promise<PublishedBlogCard[]> => {
    try {
      const { db } = await import('@/db');
      const { content } = await import('@/db/schema');
      const { eq, and, desc, asc } = await import('drizzle-orm');

      return await db
        .select({
          id: content.id,
          slug: content.slug,
          title: content.title,
          excerpt: content.excerpt,
          heroImage: content.heroImage,
          heroImageAlt: content.heroImageAlt,
          category: content.category,
          author: content.author,
          readTimeMinutes: content.readTimeMinutes,
          publishedAt: content.publishedAt,
          updatedAt: content.updatedAt,
          seoDescription: content.seoDescription,
        })
        .from(content)
        .where(and(
          eq(content.contentType, 'BLOG_POST'),
          eq(content.status, 'PUBLISHED'),
          eq(content.isActive, true),
        ))
        .orderBy(desc(content.publishedAt), desc(content.updatedAt), asc(content.slug))
        .limit(BLOG_LIST_LIMIT);
    } catch {
      return [];
    }
  },
  ['published-blog-cards'],
  { revalidate: 300, tags: [PUBLIC_BLOG_TAG] },
);

// ── Published blog listing (TR) ────────────────────────────────────────────────

/**
 * Returns all PUBLISHED blog posts for the TR listing page, ordered by
 * publishedAt desc. It is a card-only, 24-item query. Falls back to [] on DB error.
 */
export async function getPublishedBlogPosts(): Promise<PublishedBlogCard[]> {
  return (await cachedPublishedBlogCards()).map(normalizeBlogCard);
}

const cachedRelatedBlogCards = unstable_cache(
  async (slug: string): Promise<PublishedBlogCard[]> => {
    try {
      const { db } = await import('@/db');
      const { content } = await import('@/db/schema');
      const { eq, and, ne, desc, asc } = await import('drizzle-orm');

      return await db
        .select({
          id: content.id,
          slug: content.slug,
          title: content.title,
          excerpt: content.excerpt,
          heroImage: content.heroImage,
          heroImageAlt: content.heroImageAlt,
          category: content.category,
          author: content.author,
          readTimeMinutes: content.readTimeMinutes,
          publishedAt: content.publishedAt,
          updatedAt: content.updatedAt,
          seoDescription: content.seoDescription,
        })
        .from(content)
        .where(and(
          eq(content.contentType, 'BLOG_POST'),
          eq(content.status, 'PUBLISHED'),
          eq(content.isActive, true),
          ne(content.slug, slug),
        ))
        .orderBy(desc(content.publishedAt), desc(content.updatedAt), asc(content.slug))
        .limit(RELATED_BLOG_LIMIT);
    } catch {
      return [];
    }
  },
  ['related-published-blog-cards'],
  { revalidate: 300, tags: [PUBLIC_BLOG_TAG] },
);

/** Returns at most four card-only related posts, newest first. */
export async function getRelatedPublishedBlogPosts(slug: string): Promise<PublishedBlogCard[]> {
  return (await cachedRelatedBlogCards(slug)).map(normalizeBlogCard);
}

// ── Single blog post (TR) ──────────────────────────────────────────────────────

/**
 * Returns a single PUBLISHED blog post by slug. Returns null if not found,
 * not published, or DB is unavailable.
 */
async function readPublishedBlogPost(slug: string): Promise<PublishedBlogPost | null> {
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

const cachedPublishedBlogPost = unstable_cache(
  readPublishedBlogPost,
  ['published-blog-post'],
  { revalidate: 300, tags: [PUBLIC_BLOG_TAG] },
);

export async function getPublishedBlogPost(slug: string): Promise<PublishedBlogPost | null> {
  const post = await cachedPublishedBlogPost(slug);
  return post ? normalizeBlogPost(post) : null;
}

// ── Non-TR translation ─────────────────────────────────────────────────────────

/**
 * Returns a published translation for a given slug (translated or source) and lang.
 * Tries translated slug first, then falls back to source content slug.
 */
async function readPublishedBlogTranslation(
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

const cachedPublishedBlogTranslation = unstable_cache(
  readPublishedBlogTranslation,
  ['published-blog-translation'],
  { revalidate: 300, tags: [PUBLIC_BLOG_TAG] },
);

export async function getPublishedBlogTranslation(
  slug: string,
  lang: string,
): Promise<PublishedBlogTranslation | null> {
  const translation = await cachedPublishedBlogTranslation(slug, lang);
  return translation ? normalizeBlogTranslation(translation) : null;
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

async function readPublishedBlogTranslations(
  lang: string,
): Promise<TranslatedBlogListItem[]> {
  try {
    const { db }                          = await import('@/db');
    const { contentTranslations, content } = await import('@/db/schema');
    const { eq, and, desc, asc, sql }          = await import('drizzle-orm');

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
        eq(content.isActive,                       true),
      ))
      .orderBy(desc(contentTranslations.publishedAt), desc(content.updatedAt), asc(content.slug))
      .limit(BLOG_LIST_LIMIT);

    return rows;
  } catch {
    return [];
  }
}

const cachedPublishedBlogTranslations = unstable_cache(
  readPublishedBlogTranslations,
  ['published-blog-translation-cards'],
  { revalidate: 300, tags: [PUBLIC_BLOG_TAG] },
);

export async function getPublishedBlogTranslations(
  lang: string,
): Promise<TranslatedBlogListItem[]> {
  return (await cachedPublishedBlogTranslations(lang)).map(post => ({
    ...post,
    title: post.title ? removeCustomerVisibleTollCopy(post.title) : null,
    excerpt: post.excerpt ? removeCustomerVisibleTollCopy(post.excerpt) : null,
    sourceCategory: post.sourceCategory ? removeCustomerVisibleTollCopy(post.sourceCategory) : null,
    sourceHeroImageAlt: normalizeImageAlt(post.sourceHeroImageAlt),
    publishedAt: normalizeOptionalDate(post.publishedAt),
  }));
}

/**
 * Clears every public blog representation after an admin mutation.  Paths are
 * deliberately invalidated alongside the shared data tag so old detail URLs,
 * listings, localized cards and sitemap entries never outlive a publish change.
 */
export function revalidatePublicBlogPaths(input: {
  id: string;
  slug: string;
  previousSlug?: string;
  previousLocalizedSlugs?: Array<{ locale: string; slug: string | null }>;
}): void {
  revalidateTag(PUBLIC_BLOG_TAG);
  revalidatePath('/blog');
  revalidatePath(`/blog/${input.slug}`);
  if (input.previousSlug && input.previousSlug !== input.slug) {
    revalidatePath(`/blog/${input.previousSlug}`);
  }

  for (const lang of SUPPORTED_LANGS) {
    revalidatePath(`/${lang}/blog`);
  }
  for (const translation of input.previousLocalizedSlugs ?? []) {
    if (translation.locale !== 'tr' && translation.slug) {
      revalidatePath(`/${translation.locale}/blog/${translation.slug}`);
    }
  }
  revalidatePath('/sitemap.xml');
}

export async function invalidatePublicBlogCache(input: {
  id: string;
  slug: string;
  previousSlug?: string;
  previousLocalizedSlugs?: Array<{ locale: string; slug: string | null }>;
}): Promise<void> {
  revalidatePublicBlogPaths(input);

  try {
    const { db } = await import('@/db');
    const { contentTranslations } = await import('@/db/schema');
    const { eq, and } = await import('drizzle-orm');
    const translations = await db.select({
      locale: contentTranslations.targetLanguageCode,
      slug: contentTranslations.slug,
    }).from(contentTranslations).where(and(
      eq(contentTranslations.entityType, BLOG_ENTITY_TYPE),
      eq(contentTranslations.entityId, input.id),
    ));

    for (const translation of translations) {
      if (translation.locale !== 'tr' && translation.slug) {
        revalidatePath(`/${translation.locale}/blog/${translation.slug}`);
      }
    }
  } catch {
    // The committed source and listing paths above still become fresh.
  }
}

// ── Language availability ──────────────────────────────────────────────────────

/**
 * Returns language codes with a complete visitor-ready translation.
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
        eq(contentTranslations.status, 'PUBLISHED'),
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
  hasPendingDraft: boolean;
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

  const pendingDraft = row.draftBody !== null
    ? [...revisions].find(revision => {
        const snapshot = revision.snapshot;
        return snapshot.saveAsDraft === true && snapshot.status === 'PUBLISHED';
      })
    : undefined;
  const draftSnapshot = pendingDraft?.snapshot;
  const draftText = (field: string, fallback: string | null) => {
    if (!draftSnapshot || !Object.prototype.hasOwnProperty.call(draftSnapshot, field)) return fallback;
    const value = draftSnapshot[field];
    return value === null ? null : typeof value === 'string' ? value : fallback;
  };
  const draftTags = Array.isArray(draftSnapshot?.tags)
    ? draftSnapshot.tags.filter((tag): tag is string => typeof tag === 'string')
    : (row.tags as string[] | null) ?? [];

  return {
    id:             row.id,
    slug:           draftText('slug', row.slug) ?? row.slug,
    title:          draftText('title', row.title) ?? row.title,
    excerpt:        draftText('excerpt', row.excerpt ?? null),
    body:           row.draftBody ?? row.body ?? null,
    heroImage:      draftText('heroImage', row.heroImage ?? null),
    heroImageAlt:   draftText('heroImageAlt', row.heroImageAlt ?? null),
    ogImage:        draftText('ogImage', row.ogImage ?? null),
    seoTitle:       draftText('seoTitle', row.seoTitle ?? null),
    seoDescription: draftText('seoDescription', row.seoDescription ?? null),
    canonicalUrl:   draftText('canonicalUrl', row.canonicalUrl ?? null),
    indexable:      row.indexable,
    isActive:       row.isActive,
    category:       draftText('category', row.category ?? null),
    author:         draftText('author', row.author ?? null),
    tags:           draftTags,
    readTimeMinutes: typeof draftSnapshot?.readTimeMinutes === 'number'
      ? draftSnapshot.readTimeMinutes
      : row.readTimeMinutes ?? null,
    ogTitle:        draftText('ogTitle', row.ogTitle ?? null),
    ogDescription:  draftText('ogDescription', row.ogDescription ?? null),
    status:         row.status,
    publishedAt:    row.publishedAt?.toISOString() ?? null,
    scheduledAt:    row.scheduledAt?.toISOString() ?? null,
    updatedAt:      row.updatedAt.toISOString(),
    hasPendingDraft: Boolean(pendingDraft),
    translations,
    revisions,
  };
}
