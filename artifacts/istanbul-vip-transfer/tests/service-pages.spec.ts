/**
 * Service-page availability tests.
 *
 * Verifies that:
 *  1. All 14 Turkish (root) service pages return HTTP 200 and contain a non-empty
 *     <h1> element in the server-rendered HTML.
 *  2. The 4 key locale-prefixed routes (EN / DE / RU / AR) for the top service
 *     pages return HTTP 200 and contain a non-empty <h1>.
 *
 * These tests catch the silent-failure scenario where a CMS record is accidentally
 * set inactive or deleted, causing the page to 404 without any visible alert.
 *
 * Uses Playwright's `request` fixture (pure HTTP — no browser required).
 * Next.js server-renders the H1, so it is always present in the raw HTML.
 *
 * Run while the dev server is running:
 *   pnpm --filter @workspace/istanbul-vip-transfer run test:e2e
 */
import { test, expect } from '@playwright/test';
import { localizedServicePath } from '../lib/localized-service-path';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract the first <h1>…</h1> text from raw HTML, or null if absent. */
function extractH1(html: string): string | null {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match) return null;
  // Strip any inner tags and collapse whitespace
  return match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// ── Service page slugs (all 14 from PAGE_REGISTRY with schemaType='Service') ──

const SERVICE_SLUGS = [
  'istanbul-havalimani-transfer',
  'sabiha-gokcen-havalimani-transfer',
  'vip-transfer',
  'sehirler-arasi-transfer',
  'soforlu-arac-kiralama',
  'otel-transfer',
  'saglik-turizmi-transfer',
  'kurumsal-vip-transfer',
  'istanbul-bursa-transfer',
  'istanbul-sapanca-transfer',
  'istanbul-gunubirlik-turlar',
  'sapanca-masukiye-turu',
  'bursa-gunubirlik-tur',
  'yalova-gunubirlik-tur',
] as const;

// Top service pages chosen for locale-prefix coverage (EN / DE / RU / AR)
const TOP_SERVICE_SLUGS = [
  'istanbul-havalimani-transfer',
  'sabiha-gokcen-havalimani-transfer',
] as const;

const LOCALE_PREFIXES = ['en', 'de', 'ru', 'ar'] as const;

// ── TR service pages (root paths) ─────────────────────────────────────────────

test.describe('TR service pages — root paths', () => {
  for (const slug of SERVICE_SLUGS) {
    test(`/${slug} returns 200 and renders an H1`, async ({ request }) => {
      const response = await request.get(`/${slug}`);

      expect(response.status(), `Expected 200 for /${slug}`).toBe(200);

      const html = await response.text();
      const h1   = extractH1(html);

      expect(h1, `No <h1> found on /${slug}`).not.toBeNull();
      expect(h1!.length, `<h1> is empty on /${slug}`).toBeGreaterThan(0);
    });
  }
});

// ── Locale-prefixed routes (EN / DE / RU / AR) ───────────────────────────────

test.describe('Locale-prefixed service pages — EN / DE / RU / AR', () => {
  for (const slug of TOP_SERVICE_SLUGS) {
    for (const locale of LOCALE_PREFIXES) {
      test(`/${locale}/${slug} returns 200 and renders an H1`, async ({ request }) => {
        const path     = localizedServicePath(slug, locale);
        const response = await request.get(path);

        expect(response.status(), `Expected 200 for ${path}`).toBe(200);

        const html = await response.text();
        const h1   = extractH1(html);

        expect(h1, `No <h1> found on ${path}`).not.toBeNull();
        expect(h1!.length, `<h1> is empty on ${path}`).toBeGreaterThan(0);
      });
    }
  }
});

// ── Related-blog cards ──────────────────────────────────────────────────────
//
// The service-page related-blog cards are server-rendered. Keep their visible
// titles localized so a language switch never leaves Turkish link labels below
// an otherwise translated service page.

const RELATED_BLOG_LOCALES = [
  {
    path: '/en/istanbul-airport-transfer',
    texts: [
      'Related Blog Posts',
      'Istanbul Airport Transfer Guide',
      'VIP Transfer vs Taxi: What’s the Difference?',
    ],
  },
  {
    path: '/de/istanbul-flughafen-transfer',
    texts: [
      'Verwandte Blogbeiträge',
      'Istanbul Flughafen Transfer Ratgeber',
      'VIP-Transfer oder Taxi: Was sind die Unterschiede?',
    ],
  },
  {
    path: '/ru/transfer-iz-aeroporta-stambula',
    texts: [
      'Статьи по теме',
      'Гид по трансферу из аэропорта Стамбула',
      'VIP-трансфер и такси: в чём разница?',
    ],
  },
  {
    path: '/ar/nql-mtar-istnbwl',
    texts: [
      'مقالات ذات صلة',
      'دليل النقل من مطار إسطنبول',
      'ما الفرق بين نقل VIP وسيارة الأجرة؟',
    ],
  },
] as const;

test.describe('Localized related-blog cards', () => {
  for (const { path, texts } of RELATED_BLOG_LOCALES) {
    test(`${path} renders localized related-blog link labels`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), `Expected 200 for ${path}`).toBe(200);

      for (const text of texts) {
        await expect(
          page.getByText(text, { exact: true }),
          `Expected localized related-blog text on ${path}: ${text}`,
        ).toBeVisible();
      }
      await expect(page.getByText('İstanbul Havalimanı Transfer Rehberi', { exact: true })).toHaveCount(0);
    });
  }
});
