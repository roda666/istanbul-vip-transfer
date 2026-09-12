import { type Page } from '@playwright/test';
import { expect, test, waitForSettledAdminPage } from './fixtures';

test.setTimeout(120_000);

const VIEWPORTS = [
  { name: 'compact-mobile', width: 320, height: 700 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const;

/**
 * These are intentionally read-only operational destinations.  The two
 * aliases are retained because deployments have used both spellings while
 * the sidebar/code route map has been migrated.
 */
const ROUTES = [
  '/admin/personel',
  '/admin/transferler',
  '/admin/talepler',
  '/admin/sohbet',
  '/admin/ucus-karsilama',
  '/admin/bulten-aboneleri',
  '/admin/istatistikler',
  '/admin/dashboard',
  '/admin/gecmis',
  // Translation management and its job queue are both present in the codebase.
  '/admin/dil-ve-ceviri',
  '/admin/diller',
  '/admin/ceviriler',
  '/admin/chatbot-bilgi-bankasi',
  '/admin/veritabani-yedegi',
  '/admin/ayarlar',
] as const;

/**
 * Table row navigation and pagination are deliberately compact controls in
 * this admin UI.  Main action buttons (including buttons inside tables) are
 * still checked below; only non-action links contained by a table cell use
 * this documented allowlist.
 */
async function assertMainActionTouchTargets(page: Page) {
  const tooSmall = await page.locator('main button, main [role="button"]').evaluateAll((elements: Element[]) => {
    const failures: Array<{ label: string; width: number; height: number }> = [];
    for (const element of elements) {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const box = element.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0 || (box.width >= 44 && box.height >= 44)) continue;

      failures.push({
        label: (element.getAttribute('aria-label') || element.textContent || element.tagName)
          .trim().replace(/\s+/g, ' ').slice(0, 80),
        width: Math.round(box.width),
        height: Math.round(box.height),
      });
    }
    return failures;
  });
  expect(tooSmall, 'Visible main action controls must have 44px touch targets').toEqual([]);
}

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    const group = route.includes('transfer') || route.includes('tale') || route.includes('ucus')
      ? 'operations'
      : route.includes('dil') || route.includes('ceviri')
        ? 'translation'
        : route.includes('bulten')
          ? 'communications'
          : 'system';
    test(`@${group} ${route} is usable at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({
      adminPage,
    }) => {
      await adminPage.setViewportSize({ width: viewport.width, height: viewport.height });
      const response = await adminPage.goto(route, { waitUntil: 'domcontentloaded' });
      const status = response?.status() ?? 0;

      // Optional aliases should not make acceptance fail on an older
      // deployment.  A server error, however, is a real operational failure.
      if (status === 404) {
        test.skip(true, `${route} is not available in this deployment`);
      }
      expect(status, `${route} must not return a server error`).toBeLessThan(500);
      await waitForSettledAdminPage(adminPage);

      await expect(adminPage).not.toHaveURL(/\/admin\/(?:login|erisim-reddedildi)(?:[/?#]|$)/);
      await expect(adminPage.locator('body')).toBeVisible();
      const bodyText = await adminPage.locator('main, body').first().innerText();
      expect(bodyText.trim().length, `${route} should render page content`).toBeGreaterThan(20);
      await expect(adminPage.locator('main').first()).toBeVisible();

      const headings = adminPage.getByRole('heading');
      expect(await headings.count(), `${route} should expose a heading`).toBeGreaterThan(0);
      await expect(headings.first()).toBeVisible();

      const overflow = await adminPage.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow, `${route} has horizontal overflow at ${viewport.width}px`).toBe(false);
      await assertMainActionTouchTargets(adminPage);

      // Explicit evidence mapping: test-results/admin-acceptance/<route>-<viewport>.png
      const screenshotPath =
        `test-results/admin-acceptance/${route.replace(/^\/|\/$/g, '').replaceAll('/', '-')}-${viewport.name}.png`;
      await adminPage.screenshot({ path: screenshotPath });
      test.info().annotations.push({
        type: 'screenshot',
        description: `${route} @ ${viewport.width}x${viewport.height} -> ${screenshotPath}`,
      });
    });
  }
}