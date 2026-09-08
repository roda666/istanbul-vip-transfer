/**
 * Controlled location visibility smoke test. It uses the real admin login and
 * API routes, creates only UUID-suffixed records, and removes every test row.
 *
 * Required: BASE_URL=http://host:port (the already-running web application)
 * Required: DATABASE_URL (for isolated-record verification and final cleanup)
 * Run: BASE_URL=http://127.0.0.1:26004 pnpm test:location-public-visibility
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { adminUsers, auditLogs, locations } from '../db/schema';
import { hashPassword } from '../lib/auth/password';

const baseUrl = process.env.BASE_URL?.replace(/\/$/, '');
assert.ok(baseUrl, 'BASE_URL is required (for example http://127.0.0.1:26004).');
assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for database verification and cleanup.');

const suffix = randomUUID().slice(0, 12);
const testName = `TEST Location Visibility ${suffix}`;
const testSlug = `test-location-visibility-${suffix}`;
const email = `test-location-visibility-${suffix}@example.test`;
const password = `Location-test-${randomUUID()}`;
let adminId: string | undefined;
let locationId: string | undefined;
let cookie: string | undefined;

async function api(pathname: string, init: RequestInit = {}) {
  assert.ok(cookie, 'The temporary SUPER_ADMIN has not logged in.');
  return fetch(`${baseUrl}${pathname}`, {
    ...init,
    redirect: 'manual',
    headers: {
      cookie,
      ...(init.headers ?? {}),
    },
  });
}

async function deleteLocationThroughApi() {
  if (!locationId || !cookie) return;
  const first = await api(`/admin/api/locations/${locationId}`, {
    method: 'DELETE',
    headers: { origin: baseUrl! },
  });
  assert.ok(first.ok, `Location archive failed: ${first.status} ${await first.text()}`);
  const second = await api(`/admin/api/locations/${locationId}`, {
    method: 'DELETE',
    headers: { origin: baseUrl! },
  });
  assert.ok(second.ok, `Location permanent delete failed: ${second.status} ${await second.text()}`);
  locationId = undefined;
}

try {
  const [admin] = await db.insert(adminUsers).values({
    email,
    name: 'Temporary location visibility test SUPER_ADMIN',
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
  assert.equal(login.status, 200, `Temporary SUPER_ADMIN login failed: ${await login.text()}`);
  const setCookie = login.headers.get('set-cookie');
  assert.ok(setCookie, 'Login did not set an admin session cookie.');
  cookie = setCookie.split(';', 1)[0];

  const created = await api('/admin/api/locations', {
    method: 'POST',
    headers: { origin: baseUrl!, 'content-type': 'application/json' },
    body: JSON.stringify({
      name: testName, slug: testSlug, city: 'İstanbul', district: 'Test District',
      type: 'DISTRICT', scope: 'LOCAL', pickupEnabled: true, dropoffEnabled: true,
      isActive: true, displayOrder: 0,
    }),
  });
  assert.equal(created.status, 201, `Location create failed: ${await created.clone().text()}`);
  const createdBody = await created.json() as { item?: { id?: string } };
  assert.ok(createdBody.item?.id, 'Location create response did not include item.id.');
  locationId = createdBody.item.id;

  const [dbLocation] = await db.select().from(locations).where(eq(locations.id, locationId));
  assert.equal(dbLocation?.name, testName, 'Created location was not persisted in the database.');

  const publicSearch = await fetch(
    `${baseUrl}/data/locations?for=pickup&scope=local&q=${encodeURIComponent(testName)}`,
  );
  assert.equal(publicSearch.status, 200, `Public location search failed: ${await publicSearch.clone().text()}`);
  const searched = await publicSearch.json() as { locations?: Array<{ id: string }> };
  assert.ok(searched.locations?.some((item) => item.id === locationId), 'Location missing from public search.');

  const publicBrowse = await fetch(`${baseUrl}/data/locations?for=pickup&scope=local`);
  assert.equal(publicBrowse.status, 200, `Public location browse failed: ${await publicBrowse.clone().text()}`);
  const browsed = await publicBrowse.json() as { locations?: Array<{ id: string }> };
  assert.ok(browsed.locations?.some((item) => item.id === locationId), 'Location missing from public browse list.');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/#rezervasyon`, { waitUntil: 'domcontentloaded' });
    const bookingShell = page.getByTestId('booking-section-shell');
    await bookingShell.scrollIntoViewIfNeeded();
    const expandButton = bookingShell.getByRole('button', { name: /fiyat al|quote/i });
    if (await expandButton.isVisible()) await expandButton.click();
    const trigger = page.locator('button#bf-alis-lokasyon').first();
    await trigger.waitFor({ state: 'visible' });
    await trigger.click();
    await page.getByRole('combobox', { name: /alış|pickup/i }).fill(testName);
    const option = page.getByRole('option', { name: testName, exact: true });
    await option.waitFor({ state: 'visible' });
    assert.equal(await option.isVisible(), true, 'Location is not visible in the reservation LocationCombobox.');
  } finally {
    await browser.close();
  }

  console.log('Location is present in DB, public search, public browse, and /rezervasyon LocationCombobox.');
  console.log('Diagnosis: this flow is neither search-on-demand nor filtered out; /data/locations is force-dynamic.');

  const deletedLocationId = locationId;
  await deleteLocationThroughApi();
  const remaining = await db.select({ id: locations.id }).from(locations).where(eq(locations.slug, testSlug));
  assert.equal(remaining.length, 0, 'Location remains in the database after API deletion.');
  const removalResponse = await fetch(
    `${baseUrl}/data/locations?for=pickup&scope=local&q=${encodeURIComponent(testName)}`,
  );
  assert.equal(removalResponse.status, 200, `Public location removal check failed: ${await removalResponse.clone().text()}`);
  const removedPublic = await removalResponse.json() as { locations?: Array<{ id: string }> };
  assert.equal(removedPublic.locations?.some((item) => item.id === deletedLocationId), false, 'Deleted location remains public.');
  console.log('Location cleanup confirmed in DB and public search.');
} finally {
  // If an assertion interrupted the API cleanup, remove only this UUID-suffixed
  // test record; no existing location or administrator is ever targeted.
  await db.delete(locations).where(eq(locations.slug, testSlug)).catch(() => {});
  if (adminId) {
    await db.delete(auditLogs).where(eq(auditLogs.adminUserId, adminId)).catch(() => {});
    await db.delete(adminUsers).where(and(eq(adminUsers.id, adminId), eq(adminUsers.email, email))).catch(() => {});
  }
}