import { expect, screenshotEvidence, test, waitForSettledAdminPage } from './fixtures';

const allRoutes = [
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
  { id: 'transferler', name: 'Transfer Operasyonları', path: '/admin/transferler', expectsRecordActions: false },
];
const requestedIds = new Set(
  (process.env.ADMIN_ACTION_EVIDENCE_IDS ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean),
);
const routes = requestedIds.size > 0
  ? allRoutes.filter(route => requestedIds.has(route.id))
  : allRoutes;

test.use({ viewport: { width: 1440, height: 900 } });
test.setTimeout(240_000);

test(`captures ${routes.length} current preview screen(s) in one fresh authenticated session`, async ({ adminPage: page }) => {
  await page.context().setExtraHTTPHeaders({
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  });

  for (const route of routes) {
    const response = await page.goto(route.path, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });
    await waitForSettledAdminPage(page);

    expect(response?.status(), `${route.name} response`).toBe(200);
    expect(new URL(page.url()).pathname, `${route.name} must remain authenticated`)
      .not.toBe('/admin/login');

    const records = page.locator('[data-admin-record-actions]:visible');
    if (route.expectsRecordActions === false) {
      await expect(records, `${route.name} must not invent record actions`).toHaveCount(0);
    } else {
      await expect(records.first(), `${route.name} needs a visible record action group`)
        .toBeVisible({ timeout: 60_000 });
      const inline = records.first().locator('[data-admin-actions-desktop]');
      await expect(inline, `${route.name} must use the desktop shared action strip`).toBeVisible();
      const tops = await inline.locator('[data-testid^="admin-record-action-"]:visible')
        .evaluateAll(elements => elements.map(element =>
          Math.round(element.getBoundingClientRect().top),
        ));
      expect(tops.length, `${route.name} needs visible shared action buttons`).toBeGreaterThan(0);
      expect(
        new Set(tops).size,
        `${route.name} actions wrapped onto multiple rows: ${tops.join(', ')}`,
      ).toBe(1);
    }

    await screenshotEvidence(page, `fresh-preview/${route.id}-desktop`);
  }
});