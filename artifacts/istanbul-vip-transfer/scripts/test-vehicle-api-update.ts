/**
 * Controlled vehicle create/update/delete test through the real admin APIs.
 *
 * Required: BASE_URL=http://host:port (the already-running web application)
 * Required: DATABASE_URL (for isolated-record verification and final cleanup)
 * Run: BASE_URL=http://127.0.0.1:26004 pnpm test:vehicle-api-update
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { adminUsers, auditLogs, tollPoints, vehicles, vehicleTollPointClasses } from '../db/schema';
import { hashPassword } from '../lib/auth/password';

const baseUrl = process.env.BASE_URL?.replace(/\/$/, '');
assert.ok(baseUrl, 'BASE_URL is required (for example http://127.0.0.1:26004).');
assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for database verification and cleanup.');

const suffix = randomUUID().slice(0, 12);
const name = `TEST Vehicle API ${suffix}`;
const updatedName = `${name} Updated`;
const slug = `test-vehicle-api-${suffix}`;
const email = `test-vehicle-api-${suffix}@example.test`;
const password = `Vehicle-test-${randomUUID()}`;
let adminId: string | undefined;
let vehicleId: string | undefined;
let cookie: string | undefined;

async function api(pathname: string, init: RequestInit = {}) {
  assert.ok(cookie, 'The temporary SUPER_ADMIN has not logged in.');
  return fetch(`${baseUrl}${pathname}`, {
    ...init,
    redirect: 'manual',
    headers: { cookie, ...(init.headers ?? {}) },
  });
}

try {
  const [admin] = await db.insert(adminUsers).values({
    email, name: 'Temporary vehicle API test SUPER_ADMIN',
    passwordHash: await hashPassword(password), role: 'SUPER_ADMIN', active: true, sessionVersion: 1,
  }).returning({ id: adminUsers.id });
  adminId = admin.id;
  const login = await fetch(`${baseUrl}/admin/api/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }), redirect: 'manual',
  });
  assert.equal(login.status, 200, `Temporary SUPER_ADMIN login failed: ${await login.text()}`);
  const setCookie = login.headers.get('set-cookie');
  assert.ok(setCookie, 'Login did not set an admin session cookie.');
  cookie = setCookie.split(';', 1)[0];

  // Use an actual configured toll point, not a fabricated dependency.
  const [tollPoint] = await db.select({ id: tollPoints.id }).from(tollPoints).where(eq(tollPoints.active, true)).limit(1);
  assert.ok(tollPoint, 'This test requires at least one active toll point.');

  const created = await api('/admin/api/vehicles', {
    method: 'POST', headers: { origin: baseUrl!, 'content-type': 'application/json' },
    body: JSON.stringify({
      name, slug, vehicleType: 'automobile', passengerCapacity: 3, luggageCapacity: 2,
      priceCalculationEligible: false, pricingClass: 'automobile', isActive: true,
      features: [], gallery: [], displayOrder: 0, isFeatured: false, status: 'DRAFT',
      tollPointClasses: [],
    }),
  });
  assert.equal(created.status, 201, `Vehicle create failed: ${await created.clone().text()}`);
  const createdBody = await created.json() as { item?: { id?: string } };
  assert.ok(createdBody.item?.id, 'Vehicle create response did not include item.id.');
  vehicleId = createdBody.item.id;

  const updated = await api(`/admin/api/vehicles/${vehicleId}`, {
    method: 'PUT', headers: { origin: baseUrl!, 'content-type': 'application/json' },
    body: JSON.stringify({ name: updatedName, tollPointClasses: [{ tollPointId: tollPoint.id, vehicleClass: 'class_1' }] }),
  });
  assert.equal(updated.status, 200, `Vehicle update failed: ${await updated.text()}`);

  const [dbVehicle] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId));
  assert.equal(dbVehicle?.name, updatedName, 'Vehicle name was not updated in the database.');
  const [dbClass] = await db.select().from(vehicleTollPointClasses).where(
    and(eq(vehicleTollPointClasses.vehicleId, vehicleId), eq(vehicleTollPointClasses.tollPointId, tollPoint.id)),
  );
  assert.equal(dbClass?.vehicleClass, 'class_1', 'tollPointClasses update was not persisted.');
  console.log('Vehicle PUT returned 200 and updated the vehicle plus its per-toll-point class in DB.');

  const deleted = await api(`/admin/api/vehicles/${vehicleId}`, {
    method: 'DELETE', headers: { origin: baseUrl! },
  });
  assert.equal(deleted.status, 200, `Vehicle delete failed: ${await deleted.text()}`);
  vehicleId = undefined;
  const remaining = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.slug, slug));
  assert.equal(remaining.length, 0, 'Vehicle remains in the database after API deletion.');
  console.log('Vehicle API cleanup confirmed.');
} finally {
  // Emergency cleanup is limited to this unique test slug. Child class rows
  // cascade on normal deletion, and are explicitly removed for partial runs.
  if (vehicleId) await db.delete(vehicleTollPointClasses).where(eq(vehicleTollPointClasses.vehicleId, vehicleId)).catch(() => {});
  await db.delete(vehicles).where(eq(vehicles.slug, slug)).catch(() => {});
  if (adminId) {
    await db.delete(auditLogs).where(eq(auditLogs.adminUserId, adminId)).catch(() => {});
    await db.delete(adminUsers).where(and(eq(adminUsers.id, adminId), eq(adminUsers.email, email))).catch(() => {});
  }
}