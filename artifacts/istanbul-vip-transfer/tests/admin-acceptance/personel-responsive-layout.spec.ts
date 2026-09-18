import {
  assertNoHorizontalOverflow,
  expect,
  screenshotEvidence,
  test,
  waitForSettledAdminPage,
} from './fixtures';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

test.describe('Personel Yönetimi responsive layout', () => {
  for (const viewport of VIEWPORTS) {
    test(`keeps records and actions usable at ${viewport.name}`, async ({ adminPage }) => {
      await adminPage.setViewportSize({ width: viewport.width, height: viewport.height });
      const response = await adminPage.goto('/admin/personel');
      expect(response?.status()).toBe(200);
      await waitForSettledAdminPage(adminPage);

      expect(await adminPage.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      )).toBe(true);

      const staffCount = Number((await adminPage.getByText(/\d+ personel/).first().innerText()).split(' ')[0]);
      if (staffCount === 0) return;

      if (viewport.width >= 1024) {
        const row = adminPage.locator('tbody tr').first();
        await expect(row).toBeVisible();
        for (const label of ['Düzenle', 'Şifre Yenile', /Aktifleştir|Pasifleştir/, 'Sil']) {
          await expect(row.getByRole('button', { name: label, exact: typeof label === 'string' })).toBeVisible();
        }
      } else {
        const card = adminPage.locator('.lg\\:hidden > div').first();
        await expect(card).toBeVisible();
        await expect(card).toContainText('@');

        if (viewport.width <= 480) {
          const trigger = card.getByRole('button', { name: 'İşlemler', exact: true });
          await expect(trigger).toBeVisible();
          const triggerBox = await trigger.boundingBox();
          expect(triggerBox?.height ?? 0).toBeGreaterThanOrEqual(44);
          await trigger.click();
          const dialog = adminPage.getByRole('dialog');
          for (const label of ['Düzenle', 'Şifre Yenile', /Aktifleştir|Pasifleştir/, 'Sil']) {
            const action = dialog.getByRole('button', { name: label, exact: typeof label === 'string' });
            await expect(action).toBeVisible();
            const box = await action.boundingBox();
            expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
          }
        } else {
          for (const label of ['Düzenle', 'Şifre Yenile', /Aktifleştir|Pasifleştir/, 'Sil']) {
            const action = card.getByRole('button', { name: label, exact: typeof label === 'string' });
            await expect(action).toBeVisible();
            const box = await action.boundingBox();
            expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
          }
        }
      }
    });
  }

  test('keeps Personel Yönetimi inside the roomy scrollable navigation at every viewport', async ({ adminPage }) => {
    test.setTimeout(120_000);
    for (const viewport of VIEWPORTS) {
      await adminPage.setViewportSize({ width: viewport.width, height: viewport.height });
      await adminPage.goto('/admin/personel');
      await waitForSettledAdminPage(adminPage);
      if (viewport.width <= 768) {
        await adminPage.getByRole('button', { name: 'Menüyü aç' }).click();
      }

      const navKind = viewport.width <= 768 ? 'mobile' : 'desktop';
      const nav = adminPage.locator(`[data-admin-sidebar-nav="${navKind}"]`);
      const personnel = nav.locator('a[href="/admin/personel"]');
      const logout = adminPage.getByRole('button', { name: 'Çıkış Yap', exact: true });
      await expect(nav).toBeVisible();
      await expect(personnel).toHaveCount(1);
      expect(await nav.evaluate((element) => getComputedStyle(element).overflowY)).toBe('auto');
      expect(await nav.evaluate((element) => element.clientHeight > 0)).toBe(true);
      await assertNoHorizontalOverflow(adminPage);
      await screenshotEvidence(adminPage, `sidebar-personel-in-scroll-${viewport.name}`);

      if (viewport.width > 768) {
        await personnel.scrollIntoViewIfNeeded();
        await expect(personnel).toBeVisible();
        await expect(logout).toBeVisible();
        const personnelBox = await personnel.boundingBox();
        const logoutBox = await logout.boundingBox();
        expect((personnelBox?.y ?? 0) + (personnelBox?.height ?? 0)).toBeLessThan(logoutBox?.y ?? 0);
      }
    }
  });
});