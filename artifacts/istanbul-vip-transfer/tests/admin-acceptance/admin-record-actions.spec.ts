import { expect, screenshotEvidence, test, waitForSettledAdminPage } from './fixtures';

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
  { id: 'ek-hizmetler', name: 'Ek Hizmetler', path: '/admin/fiyat-kurallari?tab=ek-hizmetler' },
  { id: 'talepler', name: 'Talepler', path: '/admin/talepler' },
  { id: 'chatbot-bilgi-bankasi', name: 'Chatbot Bilgi Bankası', path: '/admin/chatbot-bilgi-bankasi' },
  { id: 'rezervasyon-ayarlari', name: 'Rezervasyon Ayarları', path: '/admin/rezervasyon-ayarlari' },
  { id: 'dil-ve-ceviri', name: 'Dil ve Çeviri', path: '/admin/dil-ve-ceviri' },
  { id: 'yol-gecis-ucretleri', name: 'Yol ve Geçiş Ücretleri', path: '/admin/yol-gecis-ucretleri' },
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
        test.setTimeout(180_000);
        const response = await page.goto(route.path);
        await waitForSettledAdminPage(page);

        const screenshotName = `admin-record-actions/${route.id}-${viewport.name}`;
        const status = response?.status() ?? 0;
        const redirectedToLogin = new URL(page.url()).pathname === '/admin/login';
        if (redirectedToLogin || [401, 403].includes(status)) {
          await screenshotEvidence(page, `${screenshotName}-skipped-permission`);
          test.skip(true, `${route.name} skipped: permission denied (HTTP ${status || 'redirected to /admin/login'})`);
          return;
        }

        const records = page.locator('[data-admin-record-actions]');
        if (await records.count() === 0) {
          await screenshotEvidence(page, `${screenshotName}-skipped-no-records`);
          test.skip(true, `${route.name} has no records in the acceptance database`);
          return;
        }

        const first = records.first();
        await expect(first).toHaveAttribute('data-admin-action-order', /.+/);
        const order = await first.getAttribute('data-admin-action-order');
        const ids = (order ?? '').split(',').filter(Boolean);
        expect(ids.every(id => canonicalOrder.includes(id))).toBe(true);
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