import { expect, screenshotEvidence, test, waitForSettledAdminPage } from './fixtures';
import { ADMIN_ACTION_APPLICABILITY } from './admin-action-inventory';

const listRoutes = [
  { id: 'blog', name: 'Blog', path: '/admin/blog' },
  { id: 'hizmetler', name: 'Hizmetler', path: '/admin/hizmetler' },
  { id: 'araclar', name: 'Araçlar', path: '/admin/araclar' },
  { id: 'soforler', name: 'Sürücüler', path: '/admin/soforler' },
  { id: 'kategoriler', name: 'Kategoriler', path: '/admin/kategoriler' },
  { id: 'rakipler', name: 'Rakipler', path: '/admin/rakipler' },
  { id: 'personel', name: 'Personel', path: '/admin/personel' },
  { id: 'menu', name: 'Menü', path: '/admin/menu' },
  { id: 'transfer-rotalari', name: 'Transfer Rotaları', path: '/admin/transfer-rotalari' },
  { id: 'sss', name: 'SSS', path: '/admin/sss' },
  { id: 'lokasyonlar', name: 'Lokasyonlar', path: '/admin/rezervasyon-ayarlari' },
  { id: 'ek-hizmetler', name: 'Ek Hizmetler', path: '/admin/fiyat-kurallari?tab=ek-hizmetler' },
];

const canonicalOrder = ['up', 'down', 'edit', 'activation', 'archive', 'custom', 'delete'];

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test.describe(`${viewport.name} admin action controls`, () => {
    test.use({ viewport });

    for (const route of listRoutes) {
      test(`${route.name} uses the Categories action pattern`, async ({ adminPage: page }) => {
        test.setTimeout(45_000);
        const response = await page.goto(route.path, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await waitForSettledAdminPage(page);

        const screenshotName = `admin-record-actions/${route.id}-${viewport.name}`;
        const status = response?.status() ?? 0;
        const redirectedToLogin = new URL(page.url()).pathname === '/admin/login';
        expect(redirectedToLogin, `${route.name} must remain authenticated`).toBe(false);
        expect([401, 403].includes(status), `${route.name} must not return permission denied`).toBe(false);

        const records = page.locator('[data-admin-record-actions]');
        await expect(records.first(), `${route.name} needs a seeded acceptance record`).toBeVisible({ timeout: 15_000 });

        const first = records.first();
        await expect(first).toHaveAttribute('data-admin-action-order', /.+/);
        const order = await first.getAttribute('data-admin-action-order');
        const ids = (order ?? '').split(',').filter(Boolean);
        expect(ids.every(id => canonicalOrder.includes(id))).toBe(true);
        const applicable = ADMIN_ACTION_APPLICABILITY[route.id];
        expect(applicable, `${route.name} must have an explicit action applicability record`).toBeDefined();
        expect(ids.every(id => applicable.includes(id)), `${route.name} rendered an undocumented action`).toBe(true);
        const positions = ids.map(id => canonicalOrder.indexOf(id));
        expect(
          positions.every((position, index) => index === 0 || position >= positions[index - 1]),
          `${route.name} action order must be a canonical-order subsequence`,
        ).toBe(true);

        if (viewport.width <= 480) {
          await expect(first.locator('[data-admin-actions-mobile-trigger]')).toBeVisible();
          await first.locator('[data-admin-actions-mobile-trigger]').click();
          const sheet = page.locator('[data-admin-actions-mobile-sheet]').last();
          await expect(sheet).toBeVisible();
          await expect(sheet.locator('[data-testid^="admin-record-action-"]').first()).toBeVisible();
          await screenshotEvidence(page, screenshotName);
        } else {
          await expect(first.locator('[data-admin-actions-desktop]')).toBeVisible();
          await expect(first.locator('[data-admin-actions-mobile-trigger]')).toBeHidden();
          await expect(first.locator('[data-testid^="admin-record-action-"]').first()).toBeVisible();
          await screenshotEvidence(page, screenshotName);
        }
      });
    }
  });
}