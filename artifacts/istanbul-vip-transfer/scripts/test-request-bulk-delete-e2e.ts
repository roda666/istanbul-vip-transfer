/**
 * Controlled Talepler bulk-delete E2E.
 * Creates only UUID-tagged isTestData requests and a disposable SUPER_ADMIN,
 * drives the real login + panel UI, verifies DB deletion and per-row audits,
 * then removes every temporary admin/audit/request row in finally.
 *
 * Run while the web workflow is serving:
 *   ADMIN_TEST_BASE_URL=http://127.0.0.1:26004 pnpm test:request-bulk-delete:e2e
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
import { and, count, eq, inArray, or } from 'drizzle-orm';
import { db } from '../db';
import { adminUsers, auditLogs, reservationRequests } from '../db/schema';
import { hashPassword } from '../lib/auth/password';

const baseUrl = process.env.ADMIN_TEST_BASE_URL ?? 'http://127.0.0.1:26004';
const suffix = randomUUID().slice(0, 12);
const email = `qa-request-bulk-delete-${suffix}@example.test`;
const password = `Request-delete-${randomUUID()}`;
const references = Array.from({ length: 3 }, (_, index) => `QA-BULK-${suffix}-${index + 1}`);
const requestIds: string[] = [];
let adminId: string | undefined;

try {
  const [realBefore] = await db.select({ value: count() })
    .from(reservationRequests)
    .where(eq(reservationRequests.isTestData, false));

  const [admin] = await db.insert(adminUsers).values({
    email,
    name: `Temporary request bulk-delete SUPER_ADMIN ${suffix}`,
    passwordHash: await hashPassword(password),
    role: 'SUPER_ADMIN',
    active: true,
    sessionVersion: 1,
  }).returning({ id: adminUsers.id });
  adminId = admin.id;

  const inserted = await db.insert(reservationRequests).values(references.map((referenceNumber, index) => ({
    referenceNumber,
    intent: index === 0 ? 'QUOTE' as const : 'RESERVATION' as const,
    serviceType: index === 0 ? 'CONTACT_INQUIRY' : 'AIRPORT_TRANSFER',
    name: `[QA BULK DELETE] ${suffix} ${index + 1}`,
    phone: `+90000000${index + 1}`,
    normalizedEmail: `qa-bulk-${suffix}-${index + 1}@example.test`,
    locale: 'tr',
    source: 'qa-bulk-delete-e2e',
    pageSlug: '/qa-bulk-delete-e2e',
    requestData: { qa: true, testRun: suffix, sequence: index + 1 },
    status: 'NEW' as const,
    isTestData: true,
  }))).returning({ id: reservationRequests.id });
  requestIds.push(...inserted.map(row => row.id));
  assert.equal(requestIds.length, 3, 'Exactly three isolated test requests must be created.');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const login = await page.request.post(`${baseUrl}/admin/api/login`, {
      data: { email, password },
      headers: { 'content-type': 'application/json' },
    });
    assert.equal(login.status(), 200, `Temporary SUPER_ADMIN login failed: ${await login.text()}`);

    await page.goto(`${baseUrl}/admin/talepler`, { waitUntil: 'networkidle' });
    for (const reference of references) {
      const checkbox = page.getByRole('checkbox', { name: `${reference} talebini seç` });
      await checkbox.waitFor({ state: 'visible' });
      await checkbox.check();
    }
    await page.screenshot({ path: `screenshots/talepler-bulk-delete-selected-${suffix}.png`, fullPage: true });
    await page.getByText('3 talep seçili', { exact: true }).waitFor({ state: 'visible' });

    page.once('dialog', async dialog => {
      assert.match(dialog.message(), /3 talep kalıcı olarak silinecek/);
      assert.match(dialog.message(), /geri alınamaz/i);
      await dialog.accept();
    });
    const deleteResponsePromise = page.waitForResponse(response =>
      response.url().endsWith('/admin/api/requests') && response.request().method() === 'DELETE',
    );
    await page.getByRole('button', { name: /Seçilenleri sil/ }).click();
    const deleteResponse = await deleteResponsePromise;
    assert.equal(deleteResponse.status(), 200, `Bulk delete endpoint returned ${deleteResponse.status()}.`);
    const payload = await deleteResponse.json() as { ok?: boolean; deletedCount?: number };
    assert.equal(payload.ok, true);
    assert.equal(payload.deletedCount, 3);
    await page.getByText('0 talep seçili', { exact: true }).waitFor({ state: 'visible' });
  } finally {
    await browser.close();
  }

  const remaining = await db.select({ id: reservationRequests.id })
    .from(reservationRequests)
    .where(inArray(reservationRequests.id, requestIds));
  assert.equal(remaining.length, 0, 'Temporary requests remain in DB after bulk deletion.');

  const deleteAudits = await db.select({
    entityId: auditLogs.entityId,
    action: auditLogs.action,
    adminUserId: auditLogs.adminUserId,
  }).from(auditLogs).where(and(
    eq(auditLogs.adminUserId, adminId),
    eq(auditLogs.action, 'DELETE'),
    inArray(auditLogs.entityId, requestIds),
  ));
  assert.equal(deleteAudits.length, 3, 'Each deleted request must have one DELETE audit.');
  assert.deepEqual(
    new Set(deleteAudits.map(row => row.entityId)),
    new Set(requestIds),
    'DELETE audits must correspond exactly to the three temporary requests.',
  );

  const [realAfter] = await db.select({ value: count() })
    .from(reservationRequests)
    .where(eq(reservationRequests.isTestData, false));
  assert.equal(realAfter.value, realBefore.value, 'The count of real requests changed during the isolated test.');

  console.log(`PASS temporary SUPER_ADMIN login: ${email}`);
  console.log(`PASS panel selected and bulk-deleted ${requestIds.length} isolated test requests`);
  console.log('PASS DB deletion confirmed: 0 temporary requests remain');
  console.log('PASS audit confirmed: 3 DELETE rows, one per temporary request');
  console.log(`PASS real request count unchanged: ${realBefore.value}`);
} finally {
  if (requestIds.length) {
    await db.delete(reservationRequests).where(inArray(reservationRequests.id, requestIds)).catch(() => {});
    await db.delete(auditLogs).where(inArray(auditLogs.entityId, requestIds)).catch(() => {});
  }
  if (adminId) {
    await db.delete(auditLogs).where(or(
      eq(auditLogs.adminUserId, adminId),
      and(eq(auditLogs.entityType, 'AdminUser'), eq(auditLogs.entityId, adminId)),
    )).catch(() => {});
    await db.delete(adminUsers).where(and(eq(adminUsers.id, adminId), eq(adminUsers.email, email))).catch(() => {});
  }
}