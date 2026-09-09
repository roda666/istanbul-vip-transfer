import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { adminUsers, auditLogs, vehicleFeatureDefaults } from '../db/schema';
import { hashPassword } from '../lib/auth/password';
import { PUBLIC_VEHICLE_LOCALES } from '../lib/vehicle-feature-catalog';
import { chromium } from '@playwright/test';

const baseUrl = process.env.BASE_URL?.replace(/\/$/, '');
assert.ok(baseUrl, 'BASE_URL is required.');

const suffix = randomUUID().slice(0, 12);
const email = `test-feature-translation-${suffix}@example.test`;
const password = `Feature-test-${randomUUID()}`;
const code = `CUSTOM_TEST_${suffix.replaceAll('-', '_')}`;
let adminId: string | undefined;
const [snapshot] = await db.select().from(vehicleFeatureDefaults).where(eq(vehicleFeatureDefaults.id, 1)).limit(1);

try {
  const [admin] = await db.insert(adminUsers).values({
    email,
    name: 'Temporary feature translation test admin',
    passwordHash: await hashPassword(password),
    role: 'SUPER_ADMIN',
    active: true,
    sessionVersion: 1,
  }).returning({ id: adminUsers.id });
  adminId = admin.id;

  const login = await fetch(`${baseUrl}/admin/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  });
  assert.equal(login.status, 200, `Login failed: ${await login.text()}`);
  const cookie = login.headers.get('set-cookie')?.split(';', 1)[0];
  assert.ok(cookie, 'Login did not return a session cookie.');

  const existingCodes = snapshot?.codes ?? [];
  const existingCustom = snapshot?.customFeatures ?? [];
  const translations = Object.fromEntries(PUBLIC_VEHICLE_LOCALES.map((locale) => [locale, locale === 'tr' ? 'Bebek koltuğu' : '']));
  const saved = await fetch(`${baseUrl}/admin/api/vehicle-feature-defaults`, {
    method: 'PUT',
    headers: { cookie, origin: baseUrl, 'content-type': 'application/json' },
    body: JSON.stringify({
      codes: existingCodes,
      customFeatures: [...existingCustom, { code, translations }],
    }),
  });
  const body = await saved.json() as { error?: string; customFeatures?: Array<{ code: string; translations: Record<string, string> }> };
  assert.equal(saved.status, 200, body.error ?? 'Save failed.');

  const created = body.customFeatures?.find((feature) => feature.code === code);
  assert.ok(created, 'Translated feature missing from API response.');
  for (const locale of PUBLIC_VEHICLE_LOCALES) {
    assert.ok(created.translations[locale]?.trim(), `${locale.toUpperCase()} translation is empty.`);
  }

  const [persisted] = await db.select().from(vehicleFeatureDefaults).where(eq(vehicleFeatureDefaults.id, 1)).limit(1);
  const persistedFeature = persisted?.customFeatures.find((feature) => feature.code === code);
  assert.ok(persistedFeature, 'Translated feature missing from database.');
  for (const locale of PUBLIC_VEHICLE_LOCALES) {
    assert.ok(persistedFeature.translations[locale]?.trim(), `${locale.toUpperCase()} database translation is empty.`);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addCookies([{
      name: cookie.split('=', 1)[0],
      value: cookie.slice(cookie.indexOf('=') + 1),
      url: baseUrl,
    }]);
    const page = await context.newPage();
    const defaultsLoaded = page.waitForResponse(
      (response) => response.url().includes('/admin/api/vehicle-feature-defaults') && response.request().method() === 'GET',
      { timeout: 90_000 },
    );
    await page.goto(`${baseUrl}/admin/araclar`, { waitUntil: 'domcontentloaded' });
    const defaultsResponse = await defaultsLoaded;
    assert.equal(defaultsResponse.status(), 200, 'Defaults panel GET failed.');
    await page.locator('button').filter({ hasText: 'Varsayılan Özellikler' }).click();
    await page.getByRole('button', { name: '+ Özel özellik ekle' }).click();
    const trInput = page.getByPlaceholder('örn. Bebek koltuğu').last();
    await trInput.waitFor({ state: 'visible' });
    assert.notEqual(await trInput.evaluate((element) => getComputedStyle(element).borderStyle), 'none');
    await trInput.focus();
    assert.match(await trInput.evaluate((element) => getComputedStyle(element).boxShadow), /rgba?\(/);
    assert.ok(await page.getByPlaceholder('Kaydedince otomatik çevrilir').count() >= 8);
    console.log('PASS: custom feature inputs are visible, bordered, focus-highlighted, and have placeholders.');
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify(created.translations, null, 2));
  console.log('PASS: Turkish-only feature produced and persisted all 8 AI translations.');
} finally {
  if (snapshot) {
    await db.update(vehicleFeatureDefaults).set({
      codes: snapshot.codes,
      customFeatures: snapshot.customFeatures,
      updatedAt: snapshot.updatedAt,
      updatedBy: snapshot.updatedBy,
    }).where(eq(vehicleFeatureDefaults.id, 1));
  }
  if (adminId) {
    await db.delete(auditLogs).where(eq(auditLogs.adminUserId, adminId)).catch(() => {});
    await db.delete(adminUsers).where(and(eq(adminUsers.id, adminId), eq(adminUsers.email, email))).catch(() => {});
  }
}