/**
 * Horizontal-overflow regression guard.
 *
 * Real-estate rule: no page may ever be wider than the viewport, at any
 * breakpoint. A single stray element (fixed-width card, negative-offset
 * honeypot, non-collapsing grid, etc.) silently reintroduces a horizontal
 * scrollbar / clipped content, so this check is a permanent CI-style gate,
 * not a one-off diagnostic — run it whenever layout-affecting code changes.
 *
 * Covers one representative page from each major template (home, service,
 * blog post, route detail, vehicles) across desktop, tablet and mobile
 * widths, matching the breakpoints driving the card-carousel strip
 * (see app/globals.css: .ivt-card-strip / --ivt-strip-n).
 */
import { test, expect, type Page } from '@playwright/test';

const WIDTHS = [
  { name: 'mobile',  width: 375,  height: 900 },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'wide',     width: 1440, height: 900 },
] as const;

// A small tolerance absorbs sub-pixel rounding from scrollbars on some
// platforms; anything beyond this is a genuine overflow bug.
const OVERFLOW_TOLERANCE_PX = 1;

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const { bodyWidth, docWidth, innerWidth } = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    docWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(bodyWidth, `${label}: document.body.scrollWidth (${bodyWidth}) exceeds viewport width (${innerWidth})`).toBeLessThanOrEqual(innerWidth + OVERFLOW_TOLERANCE_PX);
  expect(docWidth, `${label}: document.documentElement.scrollWidth (${docWidth}) exceeds viewport width (${innerWidth})`).toBeLessThanOrEqual(innerWidth + OVERFLOW_TOLERANCE_PX);
}

// One representative URL per template. Route/blog slugs are looked up at
// runtime so this stays valid as content changes.
async function firstBlogPostPath(page: Page): Promise<string | null> {
  const res = await page.request.get('/sitemap.xml');
  if (!res.ok()) return null;
  const xml = await res.text();
  const match = xml.match(/<loc>[^<]*\/blog\/([a-z0-9-]+)<\/loc>/i);
  return match ? `/blog/${match[1]}` : null;
}

async function firstRoutePath(page: Page): Promise<string | null> {
  const res = await page.request.get('/sitemap.xml');
  if (!res.ok()) return null;
  const xml = await res.text();
  const match = xml.match(/<loc>[^<]*\/guzergah\/([a-z0-9-]+)<\/loc>/i);
  return match ? `/guzergah/${match[1]}` : null;
}

test.describe('Horizontal overflow guard', () => {
  for (const { name, width, height } of WIDTHS) {
    test.describe(`${name} (${width}x${height})`, () => {
      test.use({ viewport: { width, height } });

      test('homepage never exceeds viewport width', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await assertNoHorizontalOverflow(page, 'homepage');
      });

      test('a service page never exceeds viewport width', async ({ page }) => {
        await page.goto('/istanbul-havalimani-transfer');
        await page.waitForLoadState('networkidle');
        await assertNoHorizontalOverflow(page, 'service page');
      });

      test('the vehicles page never exceeds viewport width', async ({ page }) => {
        await page.goto('/araclar');
        await page.waitForLoadState('networkidle');
        await assertNoHorizontalOverflow(page, 'vehicles page');
      });

      test('a blog post never exceeds viewport width', async ({ page }) => {
        const path = await firstBlogPostPath(page);
        test.skip(!path, 'no published blog post found in sitemap.xml');
        await page.goto(path!);
        await page.waitForLoadState('networkidle');
        await assertNoHorizontalOverflow(page, 'blog post');
      });

      test('a route detail page never exceeds viewport width', async ({ page }) => {
        const path = await firstRoutePath(page);
        test.skip(!path, 'no published route page found in sitemap.xml');
        await page.goto(path!);
        await page.waitForLoadState('networkidle');
        await assertNoHorizontalOverflow(page, 'route detail page');
      });
    });
  }
});
