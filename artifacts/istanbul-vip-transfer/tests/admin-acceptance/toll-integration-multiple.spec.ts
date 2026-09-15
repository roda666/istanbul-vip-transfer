import type { APIRequestContext, Browser, BrowserContext, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { adminSectionGrants, adminUsers, auditLogs, tollInstitutionApiSettings } from '../../db/schema';
import { hashPassword } from '../../lib/auth/password';
import { assertNoHorizontalOverflow, assertTouchTargets, expect, test, waitForSettledAdminPage } from './fixtures';

async function temporaryViewOnly() {
  const id = randomUUID();
  const email = `playwright-toll-api-view-${id}@example.invalid`;
  const password = `Playwright-${randomUUID()}-${randomUUID()}`;
  await db.insert(adminUsers).values({ id, email, passwordHash: await hashPassword(password), name: 'Toll API view only', role: 'CHAT_STAFF', active: true });
  await db.insert(adminSectionGrants).values({ adminUserId: id, section: 'fleet_pricing', canView: true, canManage: false });
  return { id, email, password };
}

async function temporaryNoAccess() {
  const id = randomUUID();
  const email = `playwright-toll-api-none-${id}@example.invalid`;
  const password = `Playwright-${randomUUID()}-${randomUUID()}`;
  await db.insert(adminUsers).values({ id, email, passwordHash: await hashPassword(password), name: 'Toll API no access', role: 'CHAT_STAFF', active: true });
  return { id, email, password };
}

async function withSession(
  browser: Browser,
  baseURL: string,
  account: { email: string; password: string },
  run: (page: Page, request: APIRequestContext) => Promise<void>,
) {
  const context: BrowserContext = await browser.newContext();
  const page = await context.newPage();
  try {
    const login = await context.request.post(new URL('/admin/api/login', baseURL).toString(), {
      data: { email: account.email, password: account.password },
      headers: { 'content-type': 'application/json' },
    });
    expect(login.status()).toBe(200);
    await run(page, context.request);
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

test('manages multiple encrypted institution API records without exposing or overwriting secrets', async ({
  adminPage,
  adminIdentity,
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  if (!baseURL) throw new Error('baseURL is required');
  const suffix = randomUUID();
  const first = { organization: `QA Kurum A ${suffix}`, url: `https://api-a.example.invalid/${suffix}`, secret: `first-${suffix}-A111`, changed: `changed-${suffix}-A999` };
  const second = { organization: `QA Kurum B ${suffix}`, url: `https://api-b.example.invalid/${suffix}`, secret: `second-${suffix}-B222` };
  const createdIds: number[] = [];
  const viewOnly = await temporaryViewOnly();
  const noAccess = await temporaryNoAccess();

  const add = async (record: typeof first | typeof second) => {
    await adminPage.getByRole('button', { name: 'Yeni API Ekle', exact: true }).click();
    await adminPage.getByTestId('integration-organization').fill(record.organization);
    await adminPage.getByTestId('integration-service-url').fill(record.url);
    await adminPage.getByTestId('integration-api-code').fill(record.secret);
    const responsePromise = adminPage.waitForResponse(response =>
      response.url().endsWith('/admin/api/pricing/tolls/integration-settings') && response.request().method() === 'POST');
    await adminPage.getByTestId('integration-save').evaluate(element => {
      (element as HTMLButtonElement).click();
      (element as HTMLButtonElement).click();
    });
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const body = await response.json();
    createdIds.push(body.integration.id);
    expect(JSON.stringify(body)).not.toContain(record.secret);
  };

  try {
    await adminPage.goto('/admin/yol-gecis-ucretleri');
    await waitForSettledAdminPage(adminPage);
    await adminPage.getByRole('main').getByRole('button', { name: 'Ayarlar', exact: true }).click();
    await add(first);
    await add(second);
    await expect(adminPage.getByText(first.organization, { exact: true })).toBeVisible();
    await expect(adminPage.getByText(second.organization, { exact: true })).toBeVisible();
    await expect(adminPage.locator('body')).not.toContainText(first.secret);
    await expect(adminPage.locator('body')).not.toContainText(second.secret);

    const firstId = createdIds[0];
    const [storedBefore] = await db.select().from(tollInstitutionApiSettings).where(eq(tollInstitutionApiSettings.id, firstId));
    const firstCard = adminPage.getByTestId(`integration-card-${firstId}`);
    await firstCard.getByRole('button', { name: 'Düzenle', exact: true }).click();
    await expect(firstCard.getByTestId('integration-api-code')).toHaveValue('');
    await firstCard.getByTestId('integration-service-url').fill(`${first.url}/v2`);
    await firstCard.getByTestId('integration-save').click();
    const [storedAfterMetadata] = await db.select().from(tollInstitutionApiSettings).where(eq(tollInstitutionApiSettings.id, firstId));
    expect(storedAfterMetadata.apiCodeCiphertext).toBe(storedBefore.apiCodeCiphertext);

    await firstCard.getByRole('button', { name: 'Düzenle', exact: true }).click();
    await firstCard.getByTestId('integration-api-code').fill(first.changed);
    await firstCard.getByTestId('integration-save').click();
    await expect(adminPage.getByTestId(`integration-mask-${firstId}`)).toHaveText('••••A999');
    const [storedAfterSecret] = await db.select().from(tollInstitutionApiSettings).where(eq(tollInstitutionApiSettings.id, firstId));
    expect(storedAfterSecret.apiCodeCiphertext).not.toBe(storedBefore.apiCodeCiphertext);
    expect(storedAfterSecret.apiCodeCiphertext).not.toContain(first.changed);

    await firstCard.getByRole('button', { name: 'Pasifleştir', exact: true }).click();
    await expect(firstCard.getByText('Pasif', { exact: true })).toBeVisible();
    await firstCard.getByRole('button', { name: 'Aktifleştir', exact: true }).click();
    await expect(firstCard.getByText('Aktif', { exact: true })).toBeVisible();

    adminPage.once('dialog', dialog => dialog.dismiss());
    await firstCard.getByRole('button', { name: 'Sil', exact: true }).click();
    await expect(firstCard).toBeVisible();
    adminPage.once('dialog', dialog => dialog.accept());
    await firstCard.getByRole('button', { name: 'Sil', exact: true }).click();
    await expect(firstCard).toHaveCount(0);
    await expect(adminPage.getByText(second.organization, { exact: true })).toBeVisible();

    for (const width of [1280, 1440, 768, 390]) {
      await adminPage.setViewportSize({ width, height: 900 });
      await assertNoHorizontalOverflow(adminPage);
      await assertTouchTargets(adminPage);
    }

    await withSession(browser, baseURL, noAccess, async (_page, request) => {
      const forbidden = await request.post(new URL('/admin/api/pricing/tolls/integration-settings', baseURL).toString(), {
        data: { organizationName: 'X', serviceUrl: 'https://x.invalid', apiCode: 'secret', active: true },
      });
      expect(forbidden.status()).toBe(403);
    });

    await withSession(browser, baseURL, viewOnly, async (page, request) => {
      const list = await request.get(new URL('/admin/api/pricing/tolls/integration-settings', baseURL).toString());
      expect(list.status()).toBe(200);
      expect(await list.text()).not.toContain(second.secret);
      const mutation = await request.post(new URL('/admin/api/pricing/tolls/integration-settings', baseURL).toString(), {
        data: { organizationName: 'Read only', serviceUrl: 'https://readonly.invalid', apiCode: 'blocked', active: true },
      });
      expect(mutation.status()).toBe(403);
      await page.goto('/admin/yol-gecis-ucretleri');
      await waitForSettledAdminPage(page);
      await page.getByRole('main').getByRole('button', { name: 'Ayarlar', exact: true }).click();
      await expect(page.getByText(second.organization, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Yeni API Ekle', exact: true })).toHaveCount(0);
    });

    const audits = await db.select().from(auditLogs).where(and(
      eq(auditLogs.adminUserId, adminIdentity.id),
      inArray(auditLogs.entityId, createdIds.map(String)),
    ));
    expect(JSON.stringify(audits)).not.toContain(first.secret);
    expect(JSON.stringify(audits)).not.toContain(first.changed);
    expect(JSON.stringify(audits)).not.toContain(second.secret);
  } finally {
    if (createdIds.length) {
      await db.delete(auditLogs).where(and(eq(auditLogs.adminUserId, adminIdentity.id), inArray(auditLogs.entityId, createdIds.map(String)))).catch(() => {});
      await db.delete(tollInstitutionApiSettings).where(inArray(tollInstitutionApiSettings.id, createdIds)).catch(() => {});
    }
    await db.delete(auditLogs).where(eq(auditLogs.adminUserId, viewOnly.id)).catch(() => {});
    await db.delete(adminSectionGrants).where(eq(adminSectionGrants.adminUserId, viewOnly.id)).catch(() => {});
    await db.delete(adminUsers).where(inArray(adminUsers.id, [viewOnly.id, noAccess.id])).catch(() => {});
  }
});