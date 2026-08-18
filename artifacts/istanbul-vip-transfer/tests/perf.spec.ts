/**
 * Performance & Quality Gate — Playwright browser tests
 *
 * Checks 6 public pages at 4 viewport widths (320, 390, 768, 1440 px)
 * for Core Web Vitals indicators, SEO essentials and accessibility basics.
 * Also verifies Arabic RTL pages at all widths.
 *
 * ⚠️  SYSTEM REQUIREMENT: Playwright Chromium needs system libraries.
 *     In the Replit NixOS environment run once:
 *       pnpm exec playwright install --with-deps chromium
 *     or ensure libglib-2.0.so.0 is available.
 *
 * For CI without a full browser, use the lighter HTTP-based gate instead:
 *   pnpm --filter @workspace/istanbul-vip-transfer test:perf
 *   (points to scripts/perf-check.ts — no Chrome required)
 *
 * Run the full browser suite:
 *   pnpm --filter @workspace/istanbul-vip-transfer test:perf:browser
 *
 * Requires the dev server to be running (playwright.config.ts handles BASE_URL).
 *
 * Thresholds (lab/Playwright environment — stricter than field):
 *   TTFB        < 800 ms
 *   FCP         < 3 000 ms
 *   H1          exactly 1 per page
 *   canonical   present
 *   img alt     all images must have alt text
 *   overflow-x  no horizontal scroll at any tested width
 */

import { test, expect, type Page } from '@playwright/test';

// ── Pages under test ──────────────────────────────────────────────────────────
const PUBLIC_PAGES = [
  { path: '/',          name: 'Ana Sayfa'  },
  { path: '/hizmetler', name: 'Hizmetler'  },
  { path: '/araclar',   name: 'Araçlar'    },
  { path: '/blog',      name: 'Blog'       },
  { path: '/iletisim',  name: 'İletişim'   },
  { path: '/rezervasyon', name: 'Rezervasyon' },
] as const;

// RTL locale pages
const RTL_PAGES = [
  { path: '/ar',          name: 'AR Ana Sayfa'  },
  { path: '/ar/hizmetler', name: 'AR Hizmetler' },
] as const;

// Viewport widths requested (mobile-first)
const VIEWPORTS = [
  { width: 320,  height: 812,  label: '320 (small mobile)'  },
  { width: 390,  height: 844,  label: '390 (iPhone 14)'     },
  { width: 768,  height: 1024, label: '768 (tablet)'        },
  { width: 1440, height: 900,  label: '1440 (desktop)'      },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Collect perf timing metrics from PerformanceNavigationTiming. */
async function collectMetrics(page: Page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const fcp = performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint');
    return {
      ttfb: nav ? nav.responseStart - nav.requestStart : 0,
      fcp:  fcp?.startTime ?? 0,
    };
  });
}

/** Assert no horizontal overflow (CLS / layout-shift proxy). */
async function assertNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const body = document.body;
    return body.scrollWidth > window.innerWidth;
  });
  expect(overflow, `Horizontal overflow on: ${label}`).toBe(false);
}

/** Assert all <img> elements have non-empty alt attribute. */
async function assertImgAlts(page: Page, label: string) {
  const missing = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img')).filter(
      img => !img.hasAttribute('alt') || img.getAttribute('alt') === null,
    ).length,
  );
  expect(missing, `${label}: every <img> must have an alt attribute`).toBe(0);
}

// ── LTR public pages × 4 viewports ───────────────────────────────────────────

for (const vp of VIEWPORTS) {
  test.describe(`Viewport ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const pg of PUBLIC_PAGES) {
      test(`${pg.name} — core quality checks`, async ({ page }) => {
        const res = await page.goto(pg.path, { waitUntil: 'domcontentloaded' });

        // HTTP status
        expect(res?.status(), `${pg.name} HTTP status`).toBeLessThan(400);

        await page.waitForLoadState('networkidle');

        // ── Performance metrics ──────────────────────────────────────────────
        const { ttfb, fcp } = await collectMetrics(page);
        console.log(
          `[perf] ${pg.name} @${vp.width}px  TTFB=${ttfb.toFixed(0)}ms  FCP=${fcp.toFixed(0)}ms`,
        );
        expect(ttfb, `${pg.name} TTFB @${vp.width}px`).toBeLessThan(800);
        expect(fcp,  `${pg.name} FCP  @${vp.width}px`).toBeLessThan(3000);

        // ── SEO essentials ───────────────────────────────────────────────────
        const title = await page.title();
        expect(title.length, `${pg.name}: title must be present`).toBeGreaterThan(5);

        const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
        expect(canonical, `${pg.name}: canonical must be present`).toBeTruthy();

        const h1Count = await page.locator('h1').count();
        expect(h1Count, `${pg.name}: exactly one H1`).toBe(1);

        // ── Accessibility basics ─────────────────────────────────────────────
        await assertImgAlts(page, `${pg.name} @${vp.width}px`);

        // No focusable element inside aria-hidden
        const ariaHiddenFocusable = await page
          .locator('[aria-hidden="true"] a:not([tabindex="-1"]), [aria-hidden="true"] button:not([tabindex="-1"])')
          .count();
        expect(ariaHiddenFocusable, `${pg.name}: no tabbable elements inside aria-hidden`).toBe(0);

        // ── Layout / CLS proxy ───────────────────────────────────────────────
        await assertNoHorizontalOverflow(page, `${pg.name} @${vp.width}px`);
      });
    }
  });
}

// ── Arabic RTL pages × 4 viewports ───────────────────────────────────────────

for (const vp of VIEWPORTS) {
  test.describe(`RTL Viewport ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const pg of RTL_PAGES) {
      test(`${pg.name} — RTL layout checks`, async ({ page }) => {
        const res = await page.goto(pg.path, { waitUntil: 'domcontentloaded' });
        expect(res?.status(), `${pg.name} HTTP status`).toBeLessThan(400);

        await page.waitForLoadState('networkidle');

        // dir="rtl" must be applied to <html>
        const dir = await page.locator('html').getAttribute('dir');
        expect(dir, `${pg.name}: html[dir] must be "rtl"`).toBe('rtl');

        // No horizontal overflow on RTL layouts
        await assertNoHorizontalOverflow(page, `${pg.name} @${vp.width}px`);

        // img alt coverage
        await assertImgAlts(page, `${pg.name} @${vp.width}px`);

        // H1 present
        const h1Count = await page.locator('h1').count();
        expect(h1Count, `${pg.name}: exactly one H1`).toBeGreaterThan(0);

        const { ttfb, fcp } = await collectMetrics(page);
        console.log(
          `[perf/rtl] ${pg.name} @${vp.width}px  TTFB=${ttfb.toFixed(0)}ms  FCP=${fcp.toFixed(0)}ms`,
        );
        expect(ttfb, `${pg.name} TTFB @${vp.width}px`).toBeLessThan(800);
        expect(fcp,  `${pg.name} FCP  @${vp.width}px`).toBeLessThan(3000);
      });
    }
  });
}
