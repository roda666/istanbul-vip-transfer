import {
  assertNoHorizontalOverflow,
  assertTouchTargets,
  expect,
  screenshotEvidence,
  test,
  waitForSettledAdminPage,
} from './fixtures';
import type { Page } from '@playwright/test';

const viewports = [
  { width: 320, height: 700, name: 'compact-mobile' },
  { width: 390, height: 844, name: 'mobile' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 1440, height: 1000, name: 'desktop' },
] as const;

const routes = [
  { path: '/admin/transfer-rotalari', heading: /Transfer Rotaları/i, affordanceRole: 'button', affordance: /Yeni Güzergah Ekle/i },
  { path: '/admin/blog', heading: /Blog/i, affordanceRole: 'link', affordance: /Yeni Yazı/i },
  { path: '/admin/sss', heading: /SSS|Sıkça Sorulan/i, affordanceRole: 'button', affordance: /Yeni SSS/i },
] as const;

async function cancelOpenForm(page: Page) {
  const cancel = page.getByRole('button', { name: /^(Vazgeç|İptal)$/i }).last();
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click();
    await expect(cancel).toBeHidden();
    return;
  }

  // Route and location editors use an icon-only close button.  Scope it to
  // the visible form heading so this does not accidentally close the shell.
  const modalHeading = page.getByRole('heading', {
    name: /^(Yeni Güzergah Ekle|Güzergahı Düzenle|Yeni Lokasyon Ekle|Lokasyon Düzenle)$/i,
  }).last();
  if (await modalHeading.isVisible().catch(() => false)) {
    const close = modalHeading.locator('..').getByRole('button').first();
    if (await close.isVisible().catch(() => false)) {
      await close.click();
      await expect(modalHeading).toBeHidden();
      return;
    }
  }

  // Blog's create screen is a page, rather than an in-place form. Return to
  // the list only from that editor; the desktop sidebar also has a Blog link.
  if (/\/admin\/blog\/(yeni|[^/]+)$/.test(new URL(page.url()).pathname)) {
    const blogBack = page.locator('main').getByRole('link', { name: /^Blog$/i });
    if (await blogBack.isVisible().catch(() => false)) {
      await blogBack.click();
      await waitForSettledAdminPage(page);
    }
  }
}

test.describe('@content admin content controls', () => {
  for (const viewport of viewports) {
    test.describe(`${viewport.name} ${viewport.width}x${viewport.height}`, () => {
      test.use({ viewport });

      for (const route of routes) {
        test(`@content-${route.path.slice(7).replaceAll('/', '-')} ${route.path} is responsive and exposes content controls`, async ({ adminPage }) => {
          const response = await adminPage.goto(route.path);
          expect(response?.status()).toBe(200);
          await waitForSettledAdminPage(adminPage);
          await expect(adminPage).not.toHaveURL(/\/admin\/login/);
          const main = adminPage.locator('main');
          await expect(main.getByRole('heading', { name: route.heading }).first()).toBeVisible();
          await expect(main.getByRole(route.affordanceRole, { name: route.affordance }).first()).toBeVisible();
          await assertNoHorizontalOverflow(adminPage);
           // Links may intentionally be compact (for example the Blog list
           // navigation).  Check only controls that perform an action.
           await assertTouchTargets(
             adminPage,
             44,
             'main button[aria-label], main [role="button"][aria-label]',
           );

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
        await expect(adminPage.getByRole('textbox', { name: /Lokasyon ara/i })).toBeVisible();
        await expect(adminPage.getByRole('button', { name: /Yeni Lokasyon/i })).toBeVisible();
        await assertNoHorizontalOverflow(adminPage);
         await assertTouchTargets(
           adminPage,
           44,
           'main button[aria-label], main [role="button"][aria-label]',
         );
        const edit = adminPage.getByRole('button', { name: /Düzenle/i }).first();
        if (await edit.isVisible().catch(() => false)) {
          await edit.click();
          await cancelOpenForm(adminPage);
        } else {
          await adminPage.getByRole('button', { name: /Yeni Lokasyon/i }).click();
          await cancelOpenForm(adminPage);
        }
        await screenshotEvidence(adminPage, `rezervasyon-ayarlari-lokasyonlar-${viewport.name}`);
      });
    });
  }
});