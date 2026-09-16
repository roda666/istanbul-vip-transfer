import { and, eq, inArray } from 'drizzle-orm';
import {
  assertNoHorizontalOverflow,
  assertTouchTargets,
  expect,
  test,
  waitForSettledAdminPage,
} from './fixtures';
import { db } from '../../db';
import { adminSectionGrants, adminUsers, auditLogs, tollPoints, tollTariffs } from '../../db/schema';
import { hashPassword } from '../../lib/auth/password';

test('safely deletes only an unreferenced selected toll point across responsive widths', async ({ adminPage }) => {
  test.setTimeout(120_000);
  const suffix = crypto.randomUUID();
  const freeName = `__qa_delete_free_${suffix}`;
  const blockedName = `__qa_delete_blocked_${suffix}`;
  const [freePoint, blockedPoint] = await db.insert(tollPoints).values([
    {
      name: freeName,
      type: 'BRIDGE',
      active: false,
      displayOrder: 900_001,
      pricingMode: 'FLAT',
    },
    {
      name: blockedName,
      type: 'BRIDGE',
      active: false,
      displayOrder: 900_002,
      pricingMode: 'FLAT',
    },
  ]).returning({ id: tollPoints.id });
  await db.insert(tollTariffs).values({
    tollPointId: blockedPoint.id,
    vehicleClass: 'class_1',
    timeBand: 'ALL',
    appliesDay: true,
    appliesNight: true,
    amountKurus: 100,
    manualAmountKurus: 100,
    active: false,
  });

  try {
    await adminPage.goto('/admin/yol-gecis-ucretleri');
    await waitForSettledAdminPage(adminPage);

    await adminPage.getByRole('button', { name: new RegExp(blockedName) }).click();
    const deleteButton = adminPage.getByTestId('delete-toll-point');
    for (const width of [1440, 768, 390]) {
      await adminPage.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await assertNoHorizontalOverflow(adminPage);
      await expect(deleteButton).toBeVisible();
      await expect(deleteButton).toBeEnabled();
      await assertTouchTargets(adminPage, 44);
    }

    adminPage.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain(blockedName);
      await dialog.dismiss();
    });
    await deleteButton.click();
    await expect.poll(async () => (
      await db.select({ id: tollPoints.id }).from(tollPoints).where(eq(tollPoints.id, blockedPoint.id))
    ).length).toBe(1);

    adminPage.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain(blockedName);
      await dialog.accept();
    });
    const blockedResponse = adminPage.waitForResponse((response) =>
      response.url().includes(`/admin/api/pricing/tolls/${blockedPoint.id}`) &&
      response.request().method() === 'DELETE',
    );
    await deleteButton.click();
    expect((await blockedResponse).status()).toBe(409);
    const dependencyAlert = adminPage.locator('div[role="alert"]').filter({ hasText: blockedName });
    await expect(dependencyAlert).toContainText('1 tarife');
    await expect(dependencyAlert).toContainText('Hiçbir bağlı kayıt silinmedi');

    await adminPage.getByRole('button', { name: new RegExp(freeName) }).click();
    adminPage.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain(freeName);
      await dialog.accept();
    });
    const deleteResponse = adminPage.waitForResponse((response) =>
      response.url().includes(`/admin/api/pricing/tolls/${freePoint.id}`) &&
      response.request().method() === 'DELETE',
    );
    await adminPage.getByTestId('delete-toll-point').click();
    expect((await deleteResponse).status()).toBe(200);
    await expect(adminPage.getByRole('status')).toContainText(`${freeName}” geçiş noktası başarıyla silindi`);
    await expect.poll(async () => (
      await db.select({ id: tollPoints.id }).from(tollPoints).where(eq(tollPoints.id, freePoint.id))
    ).length).toBe(0);
  } finally {
    await db.delete(tollTariffs).where(eq(tollTariffs.tollPointId, blockedPoint.id));
    await db.delete(tollPoints).where(inArray(tollPoints.id, [freePoint.id, blockedPoint.id]));
    await db.delete(auditLogs).where(and(
      eq(auditLogs.entityType, 'TollPoint'),
      inArray(auditLogs.entityId, [freePoint.id, blockedPoint.id]),
    ));
  }
});

test('hides and rejects toll point deletion for view-only personnel', async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error('baseURL is required');
  const id = crypto.randomUUID();
  const email = `playwright-toll-delete-view-${id}@example.invalid`;
  const password = `Playwright-${crypto.randomUUID()}-${crypto.randomUUID()}`;
  await db.insert(adminUsers).values({
    id,
    email,
    passwordHash: await hashPassword(password),
    name: 'Toll delete view only',
    role: 'CHAT_STAFF',
    active: true,
  });
  await db.insert(adminSectionGrants).values({
    adminUserId: id,
    section: 'fleet_pricing',
    canView: true,
    canManage: false,
  });

  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const login = await context.request.post(new URL('/admin/api/login', baseURL).toString(), {
      data: { email, password },
      headers: { 'content-type': 'application/json' },
    });
    expect(login.status()).toBe(200);

    await page.goto('/admin/yol-gecis-ucretleri');
    await waitForSettledAdminPage(page);
    await expect(page.getByTestId('delete-toll-point')).toHaveCount(0);

    const forbidden = await context.request.delete(
      new URL(`/admin/api/pricing/tolls/${crypto.randomUUID()}`, baseURL).toString(),
    );
    expect(forbidden.status()).toBe(403);
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await db.delete(auditLogs).where(eq(auditLogs.adminUserId, id)).catch(() => {});
    await db.delete(adminSectionGrants).where(eq(adminSectionGrants.adminUserId, id)).catch(() => {});
    await db.delete(adminUsers).where(eq(adminUsers.id, id)).catch(() => {});
  }
});