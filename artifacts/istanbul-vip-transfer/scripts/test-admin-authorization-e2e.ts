/**
 * Exercises the deployed Next.js auth boundary against temporary users.
 * It creates only disposable accounts and removes them in finally.
 *
 * Run while the web workflow is serving:
 *   ADMIN_TEST_BASE_URL=http://127.0.0.1:26004 pnpm test:admin-auth:e2e
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../db';
import { adminUsers } from '../db/schema';
import { hashPassword } from '../lib/auth/password';
import { eq, inArray } from 'drizzle-orm';

const baseUrl = process.env.ADMIN_TEST_BASE_URL ?? 'http://127.0.0.1:26004';
const password = `Auth-test-${randomUUID()}`;
const suffix = randomUUID().slice(0, 8);
const createdIds: string[] = [];
let userNumber = 0;

async function createTestUser(role: 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'CHAT_STAFF') {
  const email = `authorization-${role.toLowerCase()}-${suffix}-${++userNumber}@example.test`;
  const [user] = await db.insert(adminUsers).values({
    email,
    name: `Authorization test ${role}`,
    passwordHash: await hashPassword(password),
    role,
    active: true,
    sessionVersion: 1,
  }).returning({ id: adminUsers.id });
  createdIds.push(user.id);
  return { id: user.id, email };
}

async function login(email: string): Promise<string> {
  const response = await fetch(`${baseUrl}/admin/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  });
  assert.equal(response.status, 200, `Login failed for ${email}: ${await response.text()}`);
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie, 'Login response did not set a session cookie');
  return setCookie.split(';', 1)[0];
}

async function request(pathname: string, cookie: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    ...init,
    redirect: 'manual',
    headers: {
      cookie,
      ...(init.headers ?? {}),
    },
  });
}

try {
  const editor = await createTestUser('EDITOR');
  const editorCookie = await login(editor.email);
  assert.equal((await request('/admin/api/staff', editorCookie)).status, 403, 'EDITOR must not access staff API');
  assert.equal(
    (await request('/admin/api/studio/projects/not-a-project/approve', editorCookie, {
      method: 'POST',
      headers: { origin: baseUrl, 'content-type': 'application/json' },
      body: '{"action":"approve"}',
    })).status,
    403,
    'EDITOR must not approve or auto-publish Studio content',
  );
  assert.equal(
    (await request('/admin/api/homepage/media', editorCookie, {
      method: 'POST',
      headers: { origin: baseUrl, 'content-type': 'application/json' },
      body: '{"name":"blocked.png","size":1,"contentType":"image/png"}',
    })).status,
    403,
    'EDITOR must not mint signed media upload URLs',
  );
  const editorStaffPage = await request('/admin/personel', editorCookie);
  assert.equal(editorStaffPage.status, 307, 'EDITOR must be redirected from staff page');
  assert.equal(editorStaffPage.headers.get('location'), '/admin/erisim-reddedildi');

  const chatStaff = await createTestUser('CHAT_STAFF');
  const chatCookie = await login(chatStaff.email);
  assert.equal((await request('/admin/api/chatbot/sessions', chatCookie)).status, 200, 'CHAT_STAFF must access chat sessions');
  assert.equal((await request('/admin/api/requests', chatCookie)).status, 403, 'CHAT_STAFF must not access reservations');

  const superAdmin = await createTestUser('SUPER_ADMIN');
  const superCookie = await login(superAdmin.email);
  assert.equal((await request('/admin/api/staff', superCookie)).status, 200, 'SUPER_ADMIN must access staff API');
  assert.equal(
    (await request('/admin/api/staff', superCookie, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })).status,
    403,
    'Cookie-authenticated mutation without Origin must be rejected',
  );
  assert.equal(
    (await request('/admin/api/staff', superCookie, {
      method: 'POST',
      headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
      body: '{}',
    })).status,
    403,
    'Cross-site mutation must be rejected before the route handler',
  );

  const staleUser = await createTestUser('ADMIN');
  const staleCookie = await login(staleUser.email);
  await db.update(adminUsers).set({ sessionVersion: 2 }).where(eq(adminUsers.id, staleUser.id));
  assert.equal((await request('/admin/api/requests', staleCookie)).status, 401, 'Superseded session must be rejected');

  const mediaAdmin = await createTestUser('ADMIN');
  const mediaAdminCookie = await login(mediaAdmin.email);
  const mediaAdminResponse = await request('/admin/api/homepage/media', mediaAdminCookie, {
    method: 'POST',
    headers: { origin: baseUrl, 'content-type': 'application/json' },
    body: '{"name":"allowed.png","size":1,"contentType":"image/png"}',
  });
  // A 503 is permitted here when local object-storage signing is unavailable;
  // either 200 or 503 proves the ADMIN request passed authorization to reach
  // the storage handler. A policy denial must never occur.
  assert.ok(
    [200, 503].includes(mediaAdminResponse.status),
    `ADMIN media request must reach the storage handler, got ${mediaAdminResponse.status}`,
  );

  const inactiveUser = await createTestUser('ADMIN');
  const inactiveCookie = await login(inactiveUser.email);
  await db.update(adminUsers).set({ active: false }).where(eq(adminUsers.id, inactiveUser.id));
  assert.equal((await request('/admin/api/requests', inactiveCookie)).status, 401, 'Deactivated user must be rejected');

  console.log('admin authorization E2E tests passed');
} finally {
  if (createdIds.length) {
    await db.delete(adminUsers).where(inArray(adminUsers.id, createdIds));
  }
}