/**
 * Blog post availability tests.
 *
 * Verifies that:
 *  1. All Turkish (root) blog posts return HTTP 200 and contain a non-empty
 *     <h1> element in the server-rendered HTML.
 *  2. Every published translation for each supported locale discovered in the database
 *     returns HTTP 200 and contains a non-empty <h1>.
 *
 * Turkish source routes (/blog/[slug]) are served from static blog-data.ts and
 * cannot silently go offline; they are tested exhaustively.
 *
 * Localized routes depend on contentTranslations DB records. The tests first
 * start from published translation rows and retain broken source relationships,
 * then require every discovered URL to remain online. A broken source record or
 * route regression therefore fails instead of disappearing through an inner
 * join or silently tolerating a 404. Health-check unit tests cover translations
 * that are entirely missing or have not reached a published state.
 *
 * Uses Playwright's `request` fixture (pure HTTP — no browser required).
 * Next.js server-renders the H1, so it is always present in the raw HTML.
 *
 * Run while the dev server is running:
 *   pnpm --filter @workspace/istanbul-vip-transfer run test:e2e
 */
import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { getAllSlugs } from '../lib/blog-data';
import { SUPPORTED_LANGS } from '../lib/i18n';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract the first <h1>…</h1> text from raw HTML, or null if absent. */
function extractH1(html: string): string | null {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match) return null;
  return match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

interface PublishedTranslatedBlogRoute {
  locale: string;
  slug: string;
}

/**
 * Read published BLOG_POST translations without letting an invalid source
 * relationship disappear through an inner join. A source-less translation is
 * retained because its original content type can no longer be determined and
 * any published orphan is an invalid public-content record worth failing on.
 */
async function getPublishedTranslatedBlogRoutes(
  locale: string,
): Promise<PublishedTranslatedBlogRoute[]> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to verify translated blog routes');
  }

  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const rows = await sql<{ slug: string | null }[]>`
      SELECT COALESCE(NULLIF(BTRIM(ct.slug), ''), c.slug) AS slug
      FROM content_translations ct
      LEFT JOIN content c ON ct.entity_id::uuid = c.id
      WHERE ct.entity_type = 'content'
        AND ct.target_language_code = ${locale}
        AND ct.status = 'PUBLISHED'
        AND (c.content_type = 'BLOG_POST' OR c.id IS NULL)
      ORDER BY COALESCE(NULLIF(BTRIM(ct.slug), ''), c.slug)
    `;

    return rows.map(({ slug }, index) => {
      if (!slug) {
        throw new Error(
          `Published ${locale.toUpperCase()} content translation ${index + 1} has no source record or usable slug`,
        );
      }
      return { locale, slug };
    });
  } finally {
    await sql.end();
  }
}

// ── Blog post slugs (derived from the static source of truth) ────────────────

const BLOG_SLUGS = getAllSlugs();

// ── TR blog posts (root paths) ────────────────────────────────────────────────

test.describe('TR blog posts — root paths', () => {
  for (const slug of BLOG_SLUGS) {
    test(`/blog/${slug} returns 200 and renders an H1`, async ({ request }) => {
      const path     = `/blog/${slug}`;
      const response = await request.get(path);

      expect(response.status(), `Expected 200 for ${path}`).toBe(200);

      const html = await response.text();
      const h1   = extractH1(html);

      expect(h1, `No <h1> found on ${path}`).not.toBeNull();
      expect(h1!.length, `<h1> is empty on ${path}`).toBeGreaterThan(0);
    });
  }
});

// ── Localized blog routes — published translations must stay online ──────────

test.describe('Published localized blog posts', () => {
  for (const locale of SUPPORTED_LANGS) {
    test(`${locale.toUpperCase()} published translations return 200 and render an H1`, async ({ request }) => {
      const routes = await getPublishedTranslatedBlogRoutes(locale);

      expect(
        routes.length,
        `No published ${locale.toUpperCase()} blog translations were found in the database`,
      ).toBeGreaterThan(0);

      for (const { slug } of routes) {
        const path     = `/${locale}/blog/${encodeURIComponent(slug)}`;
        const response = await request.get(path);
        expect(response.status(), `Expected published translation ${path} to return 200`).toBe(200);

        const html = await response.text();
        const h1   = extractH1(html);

        expect(h1, `No <h1> found on published translation ${path}`).not.toBeNull();
        expect(h1!.length, `<h1> is empty on ${path}`).toBeGreaterThan(0);
      }
    });
  }
});
