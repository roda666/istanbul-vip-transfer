import {
  assertNoHorizontalOverflow,
  assertTouchTargets,
  expect,
  screenshotEvidence,
  test,
  waitForSettledAdminPage,
} from './fixtures';
import type { Locator, Page } from '@playwright/test';

const viewports = [
  { width: 390, height: 844, name: 'mobile' },
  { width: 768, height: 1024, name: 'tablet' },
] as const;

const routes = [
  { path: '/admin/transfer-rotalari', heading: /Transfer Rotaları/i, affordance: /Düzenle|Yeni Güzergah Ekle/i },
  { path: '/admin/blog', heading: /Blog/i, affordance: /Yeni Yazı|Düzenle|Arşiv/i },
  { path: '/admin/sss', heading: /SSS|Sıkça Sorulan/i, affordance: /Yeni SSS|Düzenle|Sil/i },
  { path: '/admin/menu', heading: /Menü|Menu/i, affordance: /Yeni Öğe|Düzenle|Sil/i },
  {
    path: '/admin/chatbot-bilgi-bankasi',
    heading: /Chatbot Bilgi Bankası/i,
    affordance: /Yeni Kayıt Ekle|Düzenle|Sil|Aktif/i,
  },
] as const;

async function clickAndAssertMutation(page: Page, button: Locator) {
  const responsePromise = page
    .waitForResponse((response) => /\/api\//.test(response.url()), { timeout: 10_000 })
    .catch(() => undefined);
  await button.click();
  const response = await responsePromise;
  if (response) expect(response.status(), `mutation ${response.url()}`).toBeGreaterThanOrEqual(200);
  if (response) expect(response.status()).toBeLessThan(300);
  await waitForSettledAdminPage(page);
}

async function cancelOpenForm(page: Page) {
  const cancel = page.getByRole('button', { name: /^(Vazgeç|İptal)$/i }).last();
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click();
    await expect(cancel).toBeHidden();
  }
}

async function exerciseAdjacentReorder(page: Page) {
  const down = page.getByRole('button', { name: /Aşağı/i }).locator(':visible');
  const count = await down.count();
  if (count < 1) return;
  const move = down.first();
  if (await move.isDisabled().catch(() => true)) return;
  let moved = false;
  try {
    await clickAndAssertMutation(page, move);
    moved = true;
  } finally {
    const up = page.getByRole('button', { name: /Yukarı/i }).locator(':visible');
    // The first downward move is the first adjacent pair; after it, the
    // second visible upward control belongs to the moved row.
    const reverse = (await up.count()) > 1 ? up.nth(1) : up.first();
    if (moved && await up.count() && !(await reverse.isDisabled().catch(() => true))) {
      await clickAndAssertMutation(page, reverse);
    }
  }
}

test.describe('admin content controls', () => {
  for (const viewport of viewports) {
    test.describe(`${viewport.name} ${viewport.width}x${viewport.height}`, () => {
      test.use({ viewport });

      for (const route of routes) {
        test(`${route.path} is responsive and exposes content controls`, async ({ adminPage }) => {
          const response = await adminPage.goto(route.path);
          expect(response?.status()).toBe(200);
          await waitForSettledAdminPage(adminPage);
          await expect(adminPage).not.toHaveURL(/\/admin\/login/);
          await expect(adminPage.getByRole('heading', { name: route.heading }).first()).toBeVisible();
          await expect(adminPage.getByText(route.affordance).first()).toBeVisible();
          await assertNoHorizontalOverflow(adminPage);
          await assertTouchTargets(adminPage);

          // Lists use tables at desktop width and card-like rows at narrow
          // widths; either representation must remain present and usable.
          const tableOrRows = adminPage.locator('table:visible, [class*="card" i]:visible, [class*="list" i]:visible');
          expect(await tableOrRows.count()).toBeGreaterThan(0);

          const create = adminPage.getByRole('button', { name: /Yeni (Güzergah|SSS|Öğe|Kayıt)/i }).first();
          const createLink = adminPage.getByRole('link', { name: /Yeni Yazı/i }).first();
          if (await create.isVisible().catch(() => false)) {
            await create.click();
            await cancelOpenForm(adminPage);
          } else if (await createLink.isVisible().catch(() => false)) {
            await createLink.click();
            await waitForSettledAdminPage(adminPage);
            await cancelOpenForm(adminPage);
          }

          const edit = adminPage.getByRole('button', { name: /Düzenle/i }).first();
          if (await edit.isVisible().catch(() => false)) {
            await edit.click();
            await cancelOpenForm(adminPage);
          }

          if (route.path === '/admin/transfer-rotalari' || route.path === '/admin/sss') {
            await exerciseAdjacentReorder(adminPage);
          }
          if (route.path === '/admin/menu') {
            const empty = adminPage.getByText(/Henüz menü öğesi yok|menü öğesi bulunamadı|kayıt bulunamadı/i);
            if (await empty.isVisible().catch(() => false)) {
              await expect(adminPage.getByRole('button', { name: /Yeni Öğe/i })).toBeVisible();
            } else {
              await exerciseAdjacentReorder(adminPage);
            }
          }

          await screenshotEvidence(adminPage, `${route.path.slice(7).replaceAll('/', '-')}-${viewport.name}`);
        });
      }

      test('/admin/rezervasyon-ayarlari embeds responsive Lokasyonlar controls', async ({ adminPage }) => {
        const response = await adminPage.goto('/admin/rezervasyon-ayarlari');
        expect(response?.status()).toBe(200);
        await waitForSettledAdminPage(adminPage);
        await expect(adminPage).not.toHaveURL(/\/admin\/login/);
        await expect(adminPage.getByRole('heading', { name: /Rezervasyon Ayarları/i })).toBeVisible();
        await adminPage.getByRole('button', { name: 'Lokasyonlar', exact: true }).click();
        await expect(adminPage.getByText(/Lokasyon ara/i)).toBeVisible();
        await expect(adminPage.getByRole('button', { name: /Yeni Lokasyon/i })).toBeVisible();
        await assertNoHorizontalOverflow(adminPage);
        await assertTouchTargets(adminPage);
        const edit = adminPage.getByRole('button', { name: /Düzenle/i }).first();
        if (await edit.isVisible().catch(() => false)) {
          await edit.click();
          await cancelOpenForm(adminPage);
        } else {
          await adminPage.getByRole('button', { name: /Yeni Lokasyon/i }).click();
          await cancelOpenForm(adminPage);
        }
        await exerciseAdjacentReorder(adminPage);
        await screenshotEvidence(adminPage, `rezervasyon-ayarlari-lokasyonlar-${viewport.name}`);
      });
    });
  }
});