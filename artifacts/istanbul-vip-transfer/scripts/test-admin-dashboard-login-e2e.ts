/**
 * Controlled admin login/dashboard E2E.
 * Uses a disposable ADMIN, warms the dev compiler once, then measures the real
 * login form → dashboard flow and rejects any DEP0169/error-overlay evidence.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { chromium } from '@playwright/test';
import { and, eq, or } from 'drizzle-orm';
import { db } from '../db';
import { adminUsers, auditLogs } from '../db/schema';
import { hashPassword } from '../lib/auth/password';

const baseUrl = process.env.ADMIN_TEST_BASE_URL ?? 'http://127.0.0.1:26004';
const suffix = randomUUID().slice(0, 12);
const email = `qa-dashboard-login-${suffix}@example.test`;
const password = `Dashboard-login-${randomUUID()}`;
let adminId: string | undefined;

try {
  const [admin] = await db.insert(adminUsers).values({
    email,
    name: `Temporary dashboard login ADMIN ${suffix}`,
    passwordHash: await hashPassword(password),
    role: 'ADMIN',
    active: true,
    sessionVersion: 1,
  }).returning({ id: adminUsers.id });
  adminId = admin.id;

  const browser = await chromium.launch({ headless: true });
  try {
    // Warm Next's development compiler so the timing measures application work,
    // not first-request compilation.
    const warmContext = await browser.newContext();
    const warmPage = await warmContext.newPage();
    const warmLogin = await warmPage.request.post(`${baseUrl}/admin/api/login`, {
      data: { email, password },
      headers: { 'content-type': 'application/json' },
    });
    assert.equal(warmLogin.status(), 200);
    const warmDashboard = await warmPage.goto(`${baseUrl}/admin/dashboard`, { waitUntil: 'networkidle' });
    assert.equal(warmDashboard?.status(), 200);
    await warmContext.close();

    const context = await browser.newContext();
    const page = await context.newPage();
    const consoleProblems: string[] = [];
    page.on('console', message => {
      const text = message.text();
      if (message.type() === 'error' || /DEP0169|url\.parse|Console Error/i.test(text)) consoleProblems.push(text);
    });
    page.on('pageerror', error => consoleProblems.push(error.message));

    await page.goto(`${baseUrl}/admin/login`, { waitUntil: 'networkidle' });
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);

    const start = performance.now();
    const loginResponsePromise = page.waitForResponse(response =>
      response.url().endsWith('/admin/api/login') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click();
    const loginResponse = await loginResponsePromise;
    const loginMs = performance.now() - start;
    assert.equal(loginResponse.status(), 200);

    await page.waitForURL('**/admin/dashboard', { timeout: 15_000 });
    await page.getByRole('heading', { name: 'Operasyon Merkezi', exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    const totalMs = performance.now() - start;

    const body = await page.locator('body').innerText();
    assert.doesNotMatch(body, /DEP0169|url\.parse\(\)|Console Error/i);
    assert.deepEqual(consoleProblems, [], `Unexpected console/page errors: ${consoleProblems.join('\n')}`);
    assert.ok(totalMs < 5_000, `Warm login → dashboard took too long: ${Math.round(totalMs)}ms`);

    console.log(`PASS real login form response: ${Math.round(loginMs)}ms`);
    console.log(`PASS login to dashboard ready: ${Math.round(totalMs)}ms`);
    console.log('PASS no DEP0169, url.parse warning, page error, or Next error overlay');
    await context.close();
  } finally {
    await browser.close();
  }
} finally {
  if (adminId) {
    await db.delete(auditLogs).where(or(
      eq(auditLogs.adminUserId, adminId),
      and(eq(auditLogs.entityType, 'AdminUser'), eq(auditLogs.entityId, adminId)),
    )).catch(() => {});
    await db.delete(adminUsers).where(and(eq(adminUsers.id, adminId), eq(adminUsers.email, email))).catch(() => {});
  }
}