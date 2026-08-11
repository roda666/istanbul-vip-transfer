/**
 * Blog post availability tests.
 *
 * Verifies that:
 *  1. All Turkish (root) blog posts return HTTP 200 and contain a non-empty
 *     <h1> element in the server-rendered HTML.
 *  2. For any localized blog URL that returns 200, it also contains a non-empty
 *     <h1> — so a broken translation cannot slip through as a blank page.
 *
 * Turkish source routes (/blog/[slug]) are served from static blog-data.ts and
 * cannot silently go offline; they are tested exhaustively.
 *
 * Localized routes (/en/blog/…, /de/blog/…, etc.) depend on contentTranslations
 * DB records. A 404 on a localized route means "no translation published yet"
 * which may be acceptable on a fresh install, but a 200 with no H1 or a 5xx
 * always indicates a problem. These tests catch both scenarios:
 *   - 200 without H1 → assertion failure (broken render)
 *   - 5xx           → assertion failure (server error)
 *   - 404           → allowed (translation not yet created)
 *
 * The health-check unit tests (blog-health.spec.ts) independently verify that
 * the server's health logic correctly identifies missing or unpublished
 * translations, providing full coverage of the detection path.
 *
 * Uses Playwright's `request` fixture (pure HTTP — no browser required).
 * Next.js server-renders the H1, so it is always present in the raw HTML.
 *
 * Run while the dev server is running:
 *   pnpm --filter @workspace/istanbul-vip-transfer run test:e2e
 */
import { test, expect } from '@playwright/test';
import { getAllSlugs } from '../lib/blog-data';
import { SUPPORTED_LANGS } from '../lib/i18n';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract the first <h1>…</h1> text from raw HTML, or null if absent. */
function extractH1(html: string): string | null {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match) return null;
  return match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
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

// ── Localized blog routes — translation render integrity ──────────────────────
//
// For each locale × slug combination: if the server returns 200, it MUST also
// render a non-empty <h1>. A 404 (no translation yet) is tolerated; a 5xx or a
// 200 with no H1 is always a failure.

test.describe('Localized blog posts — render integrity when translations exist', () => {
  for (const locale of SUPPORTED_LANGS) {
    for (const slug of BLOG_SLUGS) {
      test(`/${locale}/blog/${slug} — if 200, must render an H1`, async ({ request }) => {
        const path     = `/${locale}/blog/${slug}`;
        const response = await request.get(path);
        const status   = response.status();

        // 404 = no translation published yet — acceptable on a fresh install
        if (status === 404) return;

        // Any status other than 200 or 404 is a server error
        expect(status, `Unexpected status ${status} for ${path}`).toBe(200);

        const html = await response.text();
        const h1   = extractH1(html);

        expect(h1, `No <h1> found on ${path} (translation exists but renders without H1)`).not.toBeNull();
        expect(h1!.length, `<h1> is empty on ${path}`).toBeGreaterThan(0);
      });
    }
  }
});
