/**
 * Controlled Talepler export E2E.
 * Creates only UUID-tagged isTestData requests and a disposable ADMIN,
 * verifies selected and row-level Excel/PDF exports through the real panel,
 * then removes every temporary row in finally.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium, type Page, type Response } from '@playwright/test';
import { and, count, eq, inArray, or } from 'drizzle-orm';
import { db } from '../db';
import { adminUsers, auditLogs, reservationRequests } from '../db/schema';
import { hashPassword } from '../lib/auth/password';

const baseUrl = process.env.ADMIN_TEST_BASE_URL ?? 'http://127.0.0.1:26004';
const suffix = randomUUID().slice(0, 12);
const email = `qa-request-export-${suffix}@example.test`;
const password = `Request-export-${randomUUID()}`;
const references = Array.from({ length: 3 }, (_, index) => `QA-EXPORT-${suffix}-${index + 1}`);
const requestIds: string[] = [];
let adminId: string | undefined;

function exportResponse(page: Page, format: 'xls' | 'pdf') {
  return page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === '/admin/api/requests/export'
      && url.searchParams.get('format') === format;
  });
}

async function verifyResponse(
  page: Page,
  response: Response,
  expectedIds: string[],
  includedReferences: string[],
  excludedReferences: string[],
) {
  assert.equal(response.status(), 200);
  const url = new URL(response.url());
  assert.deepEqual(url.searchParams.getAll('ids'), expectedIds, 'Export request must send only the expected repeated IDs.');
  assert.equal(response.headers()['x-export-row-count'], String(expectedIds.length), 'Backend must export exactly the requested row count.');
  const verificationResponse = await page.request.get(response.url());
  assert.equal(verificationResponse.status(), 200);
  assert.equal(verificationResponse.headers()['x-export-row-count'], String(expectedIds.length));
  const body = (await verificationResponse.body()).toString('utf8');
  for (const reference of includedReferences) assert.match(body, new RegExp(reference));
  for (const reference of excludedReferences) assert.doesNotMatch(body, new RegExp(reference));
  return body;
}

try {
  const [realBefore] = await db.select({ value: count() })
    .from(reservationRequests)
    .where(eq(reservationRequests.isTestData, false));

  const [admin] = await db.insert(adminUsers).values({
    email,
    name: `Temporary request export ADMIN ${suffix}`,
    passwordHash: await hashPassword(password),
    role: 'ADMIN',
    active: true,
    sessionVersion: 1,
  }).returning({ id: adminUsers.id });
  adminId = admin.id;

  const inserted = await db.insert(reservationRequests).values(references.map((referenceNumber, index) => ({
    referenceNumber,
    intent: index === 0 ? 'QUOTE' as const : 'RESERVATION' as const,
    serviceType: index === 0 ? 'CONTACT_INQUIRY' : 'AIRPORT_TRANSFER',
    name: `[QA REQUEST EXPORT] ${suffix} ${index + 1}`,
    phone: `+90111000${index + 1}`,
    normalizedEmail: `qa-export-${suffix}-${index + 1}@example.test`,
    locale: 'tr',
    source: 'qa-request-export-e2e',
    pageSlug: '/qa-request-export-e2e',
    requestData: { flightNumber: `QA${index + 1}`, qaMarker: suffix, sequence: index + 1 },
    adminNotes: `QA export note ${suffix} ${index + 1}`,
    status: 'NEW' as const,
    isTestData: true,
  }))).returning({ id: reservationRequests.id });
  requestIds.push(...inserted.map(row => row.id));
  assert.equal(requestIds.length, 3);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
    const login = await page.request.post(`${baseUrl}/admin/api/login`, {
      data: { email, password },
      headers: { 'content-type': 'application/json' },
    });
    assert.equal(login.status(), 200, `Temporary ADMIN login failed: ${await login.text()}`);

    await page.goto(`${baseUrl}/admin/talepler`, { waitUntil: 'networkidle' });
    await page.getByRole('checkbox', { name: `${references[0]} talebini seç` }).check();
    await page.getByRole('checkbox', { name: `${references[1]} talebini seç` }).check();
    await page.getByText('2 talep seçili', { exact: true }).waitFor();
    await page.getByLabel('Dışa aktarma kapsamı').selectOption('selected');

    let responsePromise = exportResponse(page, 'xls');
    await page.getByRole('button', { name: "Excel'e Aktar" }).click();
    let response = await responsePromise;
    await verifyResponse(page, response, requestIds.slice(0, 2), references.slice(0, 2), references.slice(2));

    responsePromise = exportResponse(page, 'pdf');
    await page.getByRole('button', { name: "PDF'e Aktar" }).click();
    response = await responsePromise;
    const selectedPdf = await verifyResponse(page, response, requestIds.slice(0, 2), references.slice(0, 2), references.slice(2));
    assert.match(selectedPdf, /Talepler Raporu/);

    await page.getByRole('button', { name: `${references[2]} talebini Excel indir` }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: `${references[1]} talebini PDF indir` }).waitFor({ state: 'visible' });
    await page.setViewportSize({ width: 390, height: 844 });

    responsePromise = exportResponse(page, 'xls');
    await page.getByRole('button', { name: `${references[2]} talebini Excel indir` }).click();
    response = await responsePromise;
    const singleExcel = await verifyResponse(page, response, [requestIds[2]], [references[2]], references.slice(0, 2));
    assert.match(singleExcel, /Yönetici Notları/);
    assert.match(singleExcel, new RegExp(`QA export note ${suffix} 3`));

    responsePromise = exportResponse(page, 'pdf');
    await page.getByRole('button', { name: `${references[1]} talebini PDF indir` }).click();
    response = await responsePromise;
    const singlePdf = await verifyResponse(page, response, [requestIds[1]], [references[1]], [references[0], references[2]]);
    assert.match(singlePdf, /Talep Detayi/);
    assert.match(singlePdf, new RegExp(`QA export note ${suffix} 2`));
  } finally {
    await browser.close();
  }

  const [realAfter] = await db.select({ value: count() })
    .from(reservationRequests)
    .where(eq(reservationRequests.isTestData, false));
  assert.equal(realAfter.value, realBefore.value, 'The count of real requests changed during export E2E.');

  console.log('PASS selected Excel sent exactly 2 checked IDs and exported only those 2 rows');
  console.log('PASS selected PDF sent exactly 2 checked IDs and exported only those 2 rows');
  console.log('PASS desktop row Excel/PDF buttons are visible');
  console.log('PASS mobile row Excel exported exactly the clicked request in detailed format');
  console.log('PASS mobile row PDF exported exactly the clicked request in detailed format');
  console.log(`PASS real request count unchanged: ${realBefore.value}`);
} finally {
  if (requestIds.length) {
    await db.delete(auditLogs).where(inArray(auditLogs.entityId, requestIds)).catch(() => {});
    await db.delete(reservationRequests).where(inArray(reservationRequests.id, requestIds)).catch(() => {});
  }
  if (adminId) {
    await db.delete(auditLogs).where(or(
      eq(auditLogs.adminUserId, adminId),
      and(eq(auditLogs.entityType, 'AdminUser'), eq(auditLogs.entityId, adminId)),
    )).catch(() => {});
    await db.delete(adminUsers).where(and(eq(adminUsers.id, adminId), eq(adminUsers.email, email))).catch(() => {});
  }
}