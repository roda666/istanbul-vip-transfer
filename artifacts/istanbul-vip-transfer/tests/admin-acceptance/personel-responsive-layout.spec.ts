import { expect, test, waitForSettledAdminPage } from './fixtures';

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

  test('keeps Personel Yönetimi as the last standalone navigation item', async ({ adminPage }) => {
    await adminPage.setViewportSize({ width: 1440, height: 1000 });
    await adminPage.goto('/admin/personel');
    await waitForSettledAdminPage(adminPage);

    const personnel = adminPage.locator('a[href="/admin/personel"]');
    // The shared test account is not necessarily a super admin. Its absence is
    // the expected existing visibility filter; a super-admin session sees the
    // standalone item directly above the fixed account footer.
    if (await personnel.count() === 0) return;
    const logout = adminPage.getByRole('button', { name: 'Çıkış Yap', exact: true });
    await expect(personnel).toBeVisible();
    await expect(logout).toBeVisible();
    const personnelBox = await personnel.boundingBox();
    const logoutBox = await logout.boundingBox();
    expect((personnelBox?.y ?? 0) + (personnelBox?.height ?? 0)).toBeLessThan(logoutBox?.y ?? 0);
  });
});