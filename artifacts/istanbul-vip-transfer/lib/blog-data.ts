/**
 * Typed local blog content source.
 * Designed for future CMS migration: swap this file's exports for
 * async CMS SDK calls without touching the page components.
 *
 * Add approved articles here. Until the first article is published:
 *  - /blog is excluded from the sitemap and set to noindex.
 *  - /blog/[slug] generates no static pages (generateStaticParams returns []).
 */

export interface BlogPost {
  /** Display title — also used in <title> and og:title */
  title: string;
  /** URL-safe slug, e.g. "istanbul-havalimani-transfer-rehberi" */
  slug: string;
  /** 105–155 character meta description */
  description: string;
  /** ISO 8601 date string, e.g. "2026-07-27" */
  publishedAt: string;
  /** ISO 8601 date string — omit if never updated after publish */
  updatedAt?: string;
  /** Display category, e.g. "Transfer Rehberi" */
  category: string;
  /** Path to image in /public or an absolute URL */
  image: string;
  /** Descriptive alt text for the article image */
  imageAlt: string;
  /**
   * Article body. Plain text / Markdown for now.
   * The blog article page component renders this directly as prose.
   * Swap for MDX or a CMS rich-text field when upgrading.
   */
  body: string;
}

/**
 * All published blog articles.
 * Keep empty until the first article is approved.
 * Do NOT add placeholder or Lorem Ipsum content here.
 */
export const blogPosts: BlogPost[] = [];

/** Look up a single post by slug. Returns undefined if not found. */
export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}

/** Return all published slugs — used by generateStaticParams. */
export function getAllSlugs(): string[] {
  return blogPosts.map((p) => p.slug);
}

/** True when there is at least one published article. */
export const BLOG_LIVE = blogPosts.length > 0;
