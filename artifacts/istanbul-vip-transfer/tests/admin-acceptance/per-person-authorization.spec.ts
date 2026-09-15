import type { Browser, BrowserContext, Page, APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, or } from 'drizzle-orm';
import { db, closeDatabaseConnection } from '../../db';
import { adminSectionGrants, adminUsers, auditLogs } from '../../db/schema';
import { hashPassword } from '../../lib/auth/password';
import {
  assertNoHorizontalOverflow,
  assertTouchTargets,
  expect,
  test,
  waitForSettledAdminPage,
} from './fixtures';

type Grant = { section: string; canView: boolean; canManage: boolean };
type TemporaryAccount = { id: string; email: string; password: string; grants: Grant[] };

const fleetView: Grant = { section: 'fleet_pricing', canView: true, canManage: false };
const fleetManage: Grant = { section: 'fleet_pricing', canView: true, canManage: true };
const chatManage: Grant = { section: 'chat', canView: true, canManage: true };

async function createTemporaryStaff(grants: Grant[]): Promise<TemporaryAccount> {
  const id = randomUUID();
  const password = `Playwright-${randomUUID()}-${randomUUID()}`;
  const email = `playwright-grant-${id}@example.invalid`;
  await db.insert(adminUsers).values({
    id,
    email,
    passwordHash: await hashPassword(password),
    name: `Temporary grant ${id.slice(0, 8)}`,
    role: 'CHAT_STAFF',
    active: true,
  });
  if (grants.length) {
    await db.insert(adminSectionGrants).values(grants.map((grant) => ({
      adminUserId: id,
      ...grant,
    })));
  }
  return { id, email, password, grants };
}

/**
 * Audit rows are removed before their actor/target users and grant rows. This
 * deliberately does not rely on a database cascade so the fixture also works
 * against deployments with stricter FK settings.
 */
async function cleanupTemporaryStaff(ids: string[]) {
  if (!ids.length) return;
  await db.delete(auditLogs).where(or(
    inArray(auditLogs.adminUserId, ids),
    and(eq(auditLogs.entityType, 'AdminUser'), inArray(auditLogs.entityId, ids)),
  )).catch(() => {});
  await db.delete(adminSectionGrants).where(inArray(adminSectionGrants.adminUserId, ids)).catch(() => {});
  await db.delete(adminUsers).where(inArray(adminUsers.id, ids)).catch(() => {});
}

async function withAdminSession<T>(
  browser: Browser,
  baseURL: string,
  account: { email: string; password: string },
  callback: (page: Page, request: APIRequestContext) => Promise<T>,
): Promise<T> {
  const context: BrowserContext = await browser.newContext();
  const request = context.request;
  const page = await context.newPage();
  try {
    const login = await request.post(new URL('/admin/api/login', baseURL).toString(), {
      data: { email: account.email, password: account.password },
      headers: { 'content-type': 'application/json' },
      timeout: 45_000,
    });
    expect(login.status(), `Temporary admin login must succeed for ${account.email}`).toBe(200);
    return await callback(page, request);
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await request.dispose().catch(() => {});
  }
}

async function sameOriginMutation(
  request: APIRequestContext,
  baseURL: string,
  pathname: string,
  method: 'POST' | 'PATCH' | 'DELETE',
) {
  return request.fetch(new URL(pathname, baseURL).toString(), {
    method,
    headers: {
      origin: new URL(baseURL).origin,
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
    },
    data: method === 'POST' ? {} : { active: true },
  });
}

async function assertResponsiveAdminControls(page: Page) {
  for (const width of [1440, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await assertNoHorizontalOverflow(page);
    await assertTouchTargets(page);
  }
}

test('enforces per-person grants, guarded routes, and responsive admin actions', async ({
  adminPage,
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  if (!baseURL) throw new Error('Playwright baseURL is required for admin acceptance');

  const temporaryIds: string[] = [];
  let createdThroughPersonelId: string | null = null;
  const viewOnly = await createTemporaryStaff([fleetView]);
  const manageStaff = await createTemporaryStaff([fleetManage]);
  const noAccess = await createTemporaryStaff([]);
  const chatOnly = await createTemporaryStaff([chatManage]);
  temporaryIds.push(viewOnly.id, manageStaff.id, noAccess.id, chatOnly.id);

  const createdName = `UI staff ${randomUUID()}`;
  const editedName = `${createdName} edited`;
  const createdEmail = `playwright-ui-staff-${randomUUID()}@example.invalid`;
  const createdPassword = `UI-${randomUUID()}-${randomUUID()}`;

  try {
    // SUPER_ADMIN can create a staff record and grant it a canonical section.
    await adminPage.setViewportSize({ width: 1280, height: 900 });
    await adminPage.goto('/admin/personel');
    await waitForSettledAdminPage(adminPage);
    await expect(adminPage.getByRole('heading', { name: 'Personel Yönetimi', exact: true })).toBeVisible();
    await expect(adminPage.locator('[data-admin-action="manage"]')).not.toHaveCount(0);

    await adminPage.getByRole('button', { name: 'Yeni Personel Ekle', exact: true }).click();
    await adminPage.getByLabel('Ad Soyad').fill(createdName);
    await adminPage.getByLabel('E-posta').fill(createdEmail);
    await adminPage.getByPlaceholder('En az 8 karakter').fill(createdPassword);
    const createFleetCard = adminPage.getByText('Araçlar ve Transferler', { exact: true }).locator('xpath=..');
    await createFleetCard.locator('label').filter({ hasText: 'Yönet' }).locator('input').check();
    const createResponse = adminPage.waitForResponse((response) =>
      response.url().endsWith('/admin/api/staff') && response.request().method() === 'POST');
    await adminPage.getByRole('button', { name: 'Personel Oluştur', exact: true }).click();
    expect((await createResponse).status()).toBe(201);
    await expect(adminPage.getByText(createdEmail, { exact: true }).first()).toBeVisible();

    const [createdUser] = await db.select({ id: adminUsers.id })
      .from(adminUsers).where(eq(adminUsers.email, createdEmail));
    expect(createdUser?.id).toBeTruthy();
    createdThroughPersonelId = createdUser?.id ?? null;
    if (createdThroughPersonelId) temporaryIds.push(createdThroughPersonelId);

    // Edit all three person-level fields (identity, active state, and grants).
    const createdRow = adminPage.locator('tr').filter({ hasText: createdEmail });
    await createdRow.getByRole('button', { name: 'Düzenle', exact: true }).click();
    await adminPage.getByLabel('Ad Soyad').fill(editedName);
    await adminPage.getByLabel('Aktif').uncheck();
    const editFleetCard = adminPage.getByText('Araçlar ve Transferler', { exact: true }).locator('xpath=..');
    await editFleetCard.locator('label').filter({ hasText: 'Yönet' }).locator('input').uncheck();
    await editFleetCard.locator('label').filter({ hasText: 'Görüntüle' }).locator('input').check();
    const editChatCard = adminPage.getByText('Canlı Sohbet', { exact: true }).locator('xpath=..');
    await editChatCard.locator('label').filter({ hasText: 'Görüntüle' }).locator('input').check();
    const patchResponse = adminPage.waitForResponse((response) =>
      response.url().includes(`/admin/api/staff/${createdThroughPersonelId}`) &&
      response.request().method() === 'PATCH');
    await adminPage.getByRole('button', { name: 'Kaydet', exact: true }).click();
    expect((await patchResponse).status()).toBe(200);
    await expect(adminPage.getByText(editedName, { exact: true }).first()).toBeVisible();

    const [persistedUser] = await db.select().from(adminUsers)
      .where(eq(adminUsers.id, createdThroughPersonelId!));
    const persistedGrants = await db.select({
      section: adminSectionGrants.section,
      canView: adminSectionGrants.canView,
      canManage: adminSectionGrants.canManage,
    }).from(adminSectionGrants)
      .where(eq(adminSectionGrants.adminUserId, createdThroughPersonelId!));
    expect(persistedUser).toMatchObject({ name: editedName, active: false });
    expect(persistedGrants).toEqual(expect.arrayContaining([
      { section: 'fleet_pricing', canView: true, canManage: false },
      { section: 'chat', canView: true, canManage: false },
    ]));
    await adminPage.reload();
    await waitForSettledAdminPage(adminPage);
    await expect(adminPage.getByText(editedName, { exact: true }).first()).toBeVisible();
    await assertResponsiveAdminControls(adminPage);

    // A view-only canonical section can load its menu, page, and GET API, but
    // all state-changing methods remain denied even with same-origin headers.
    await withAdminSession(browser, baseURL, viewOnly, async (page, request) => {
      const tollPage = await page.goto('/admin/yol-gecis-ucretleri');
      expect(tollPage?.status()).toBe(200);
      await waitForSettledAdminPage(page);
      await expect(page.getByRole('heading', { name: /Yol ve Geçiş Ücretleri/, exact: false })).toBeVisible();
      await expect(page.getByRole('link', { name: /Yol & Geçiş Ücretleri/, exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Sürücüler', exact: true })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Uçuşla Karşılama', exact: true })).toHaveCount(0);
      await expect(page.locator('[data-admin-action="manage"]')).toHaveCount(0);
      await expect(page.getByText('Gösterim', { exact: true })).toHaveCount(0);

      const getResponse = await request.get(new URL('/admin/api/pricing/tolls', baseURL).toString());
      expect(getResponse.status()).toBe(200);
      for (const method of ['POST', 'PATCH', 'DELETE'] as const) {
        const response = await sameOriginMutation(
          request,
          baseURL,
          method === 'POST'
            ? '/admin/api/pricing/tolls'
            : '/admin/api/pricing/tolls/00000000-0000-0000-0000-000000000000',
          method,
        );
        expect(response.status(), `view-only ${method} must be forbidden`).toBe(403);
      }

      // Drivers is intentionally not a sidebar destination, but its direct
      // route is still protected by the same fleet view grant.
      const drivers = await page.goto('/admin/soforler');
      expect(drivers?.status()).toBe(200);
      await expect(page.getByRole('heading', { name: 'Sürücüler', exact: true })).toBeVisible();
      await page.goto('/admin/yol-gecis-ucretleri');
      await waitForSettledAdminPage(page);
      await assertResponsiveAdminControls(page);
    });

    // A manage grant must reach the mutation handler without changing real
    // data. Invalid POST data is a controlled 422 rather than an authorization
    // 403, proving method authorization after the same-origin check.
    await withAdminSession(browser, baseURL, manageStaff, async (_page, request) => {
      const response = await sameOriginMutation(request, baseURL, '/admin/api/pricing/tolls', 'POST');
      expect(response.status(), 'manage staff must pass method authorization').toBe(422);
    });

    // A user with no section grant cannot use the page directly or any CRUD
    // method, including a safe GET probe.
    await withAdminSession(browser, baseURL, noAccess, async (page, request) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/admin/ayarlar');
      await waitForSettledAdminPage(page);
      await expect(page).toHaveURL(/\/admin\/erisim-reddedildi(?:[/?#]|$)/);
      await expect(page.getByRole('link', { name: 'Hesabıma dön', exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: /Yol & Geçiş Ücretleri/, exact: true })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Sürücüler', exact: true })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Uçuşla Karşılama', exact: true })).toHaveCount(0);
      for (const pathname of ['/admin/soforler', '/admin/ucus-karsilama', '/admin/personel']) {
        await page.goto(pathname);
        await expect(page).toHaveURL(/\/admin\/erisim-reddedildi(?:[/?#]|$)/);
      }
      const getResponse = await request.get(new URL('/admin/api/pricing/tolls', baseURL).toString());
      expect(getResponse.status()).toBe(403);
      for (const method of ['POST', 'PATCH', 'DELETE'] as const) {
        const response = await sameOriginMutation(
          request,
          baseURL,
          method === 'POST'
            ? '/admin/api/pricing/tolls'
            : '/admin/api/pricing/tolls/00000000-0000-0000-0000-000000000000',
          method,
        );
        expect(response.status(), `no-access ${method} must be forbidden`).toBe(403);
      }
    });

    // A CHAT_STAFF-compatible chat grant exposes only chat and the account
    // destination; unrelated direct pages remain guarded.
    await withAdminSession(browser, baseURL, chatOnly, async (page, request) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/admin/sohbet');
      await waitForSettledAdminPage(page);
      await expect(page.getByRole('link', { name: 'Canlı Sohbet', exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Hesabım', exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: /Yol & Geçiş Ücretleri/, exact: true })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Chatbot Bilgi Bankası', exact: true })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Sürücüler', exact: true })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Uçuşla Karşılama', exact: true })).toHaveCount(0);
      const messagesResponse = await request.get(new URL(
        '/admin/api/chatbot/00000000-0000-0000-0000-000000000000/messages',
        baseURL,
      ).toString());
      expect(messagesResponse.status(), 'chat-only staff must pass dynamic message authorization').not.toBe(403);
      await page.goto('/admin/chatbot-bilgi-bankasi');
      await waitForSettledAdminPage(page);
      await expect(page).toHaveURL(/\/admin\/erisim-reddedildi(?:[/?#]|$)/);
    });
  } finally {
    await cleanupTemporaryStaff(temporaryIds);
    await closeDatabaseConnection().catch(() => {});
  }
});