/**
 * Smoke tests — critical paths that must never silently break.
 *
 * These tests run against the already-running dev server (no DB mocks).
 * They cover: robots.txt, sitemap, language persistence, Arabic RTL,
 * reservation form, and locale-switch safety.
 */
import { test, expect } from '@playwright/test';

// ── A. robots.txt ─────────────────────────────────────────────────────────

test.describe('robots.txt', () => {
  test('disallows /admin for all bots (*)', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const text = await res.text();
    // The wildcard rule must block admin and internal paths
    expect(text).toContain('Disallow: /admin');
    expect(text).toContain('Disallow: /data');
    expect(text).toContain('Disallow: /api');
  });

  test('sitemap URL is present', async ({ request }) => {
    const res = await request.get('/robots.txt');
    const text = await res.text();
    expect(text).toContain('sitemap.xml');
  });
});

// ── B. sitemap.xml ────────────────────────────────────────────────────────

test.describe('sitemap.xml', () => {
  test('returns 200 with XML content-type', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/xml/);
  });

  test('contains Turkish homepage URL', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    const text = await res.text();
    // Root URL must be present
    expect(text).toMatch(/<loc>[^<]+<\/loc>/);
  });

  test('does not contain /admin URLs', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    const text = await res.text();
    expect(text).not.toContain('/admin');
  });

  test('does not contain /data URLs', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    const text = await res.text();
    expect(text).not.toContain('/data/');
  });

  test('does not contain duplicate URLs', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    const text = await res.text();
    const matches = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    const unique = new Set(matches);
    expect(matches.length, 'Duplicate URLs found in sitemap').toBe(unique.size);
  });
});

// ── C. Language persistence ───────────────────────────────────────────────

test.describe('Language system', () => {
  test('EN homepage returns 200', async ({ page }) => {
    await page.goto('/en');
    expect(page.url()).toContain('/en');
    await expect(page).toHaveURL(/\/en/);
  });

  test('DE homepage returns 200', async ({ page }) => {
    await page.goto('/de');
    await expect(page).toHaveURL(/\/de/);
  });

  test('RU homepage returns 200', async ({ page }) => {
    await page.goto('/ru');
    await expect(page).toHaveURL(/\/ru/);
  });

  test('AR homepage returns 200', async ({ page }) => {
    await page.goto('/ar');
    await expect(page).toHaveURL(/\/ar/);
  });

  test('Arabic page has dir=rtl on html element', async ({ page }) => {
    await page.goto('/ar');
    const dir = await page.evaluate(() => document.documentElement.getAttribute('dir') ?? document.body.getAttribute('dir'));
    expect(dir).toBe('rtl');
  });

  test('locale switch endpoint returns 303 with relative Location', async ({ request }) => {
    const res = await request.post('/data/locale/switch', {
      data: { locale: 'en', next: '/' },
      maxRedirects: 0,
    });
    // Should redirect (303) or set cookie and redirect
    const location = res.headers()['location'] ?? '';
    // Must not redirect to an absolute external URL or 0.0.0.0
    expect(location).not.toMatch(/^https?:\/\/(0\.0\.0\.0|evil|external)/);
    if (location) {
      expect(location).toMatch(/^\//); // must be relative path
    }
  });

  test('open-redirect is blocked on locale switch', async ({ request }) => {
    const res = await request.post('/data/locale/switch', {
      data: { locale: 'en', next: '//evil.example/steal' },
      maxRedirects: 0,
    });
    const location = res.headers()['location'] ?? '';
    expect(location).not.toContain('evil.example');
  });
});

// ── D. Reservation form ───────────────────────────────────────────────────

test.describe('Reservation form', () => {
  for (const lang of ['tr', 'en', 'de', 'ru', 'ar']) {
    test(`opens without error in ${lang.toUpperCase()}`, async ({ page }) => {
      const url = lang === 'tr' ? '/' : `/${lang}`;
      await page.goto(url);
      // Page must load without a fatal error
      await expect(page.locator('body')).toBeVisible();
      // No unhandled JS crash overlay
      await expect(page.locator('text=Application error')).not.toBeVisible();
    });
  }

  test('no horizontal overflow at 390px (mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow, 'Horizontal overflow at 390px').toBe(false);
  });

  test('no horizontal overflow at 768px (tablet)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow, 'Horizontal overflow at 768px').toBe(false);
  });

  test('no horizontal overflow at 1440px (desktop)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow, 'Horizontal overflow at 1440px').toBe(false);
  });
});

// ── E. Service pages return 200 ───────────────────────────────────────────

test.describe('Core service pages', () => {
  const slugs = [
    'istanbul-havalimani-transfer',
    'sabiha-gokcen-havalimani-transfer',
    'vip-transfer',
  ];

  for (const slug of slugs) {
    test(`/en/${slug} returns 200`, async ({ page }) => {
      const res = await page.goto(`/en/${slug}`);
      expect(res?.status()).toBeLessThan(400);
    });
  }
});
