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
  assert.equal(
    (await request('/admin/api/storage/request-url', editorCookie, {
      method: 'POST',
      headers: { origin: baseUrl, 'content-type': 'application/json' },
      body: '{"name":"blocked.png","size":1,"contentType":"image/png","namespace":"service-pages"}',
    })).status,
    403,
    'EDITOR must not mint service-page signed media upload URLs',
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
  assert.equal(
    (await request('/admin/api/storage/request-url', superCookie, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"name":"blocked.png","size":1,"contentType":"image/png","namespace":"service-pages"}',
    })).status,
    403,
    'Storage mutation without Origin must be rejected',
  );
  const superStorageResponse = await request('/admin/api/storage/request-url', superCookie, {
    method: 'POST',
    headers: { origin: baseUrl, 'content-type': 'application/json' },
    body: '{"name":"allowed.png","size":1,"contentType":"image/png","namespace":"service-pages"}',
  });
  assert.ok(
    [200, 503].includes(superStorageResponse.status),
    `SUPER_ADMIN storage request must pass authorization, got ${superStorageResponse.status}`,
  );

  const staleUser = await createTestUser('ADMIN');
  const staleCookie = await login(staleUser.email);
  await db.update(adminUsers).set({ sessionVersion: 2 }).where(eq(adminUsers.id, staleUser.id));
  assert.equal((await request('/admin/api/requests', staleCookie)).status, 401, 'Superseded session must be rejected');
  assert.equal(
    (await request('/admin/api/storage/request-url', staleCookie, {
      method: 'POST',
      headers: { origin: baseUrl, 'content-type': 'application/json' },
      body: '{"name":"blocked.png","size":1,"contentType":"image/png","namespace":"service-pages"}',
    })).status,
    401,
    'Superseded session must not mint a storage upload URL',
  );

  const mediaAdmin = await createTestUser('ADMIN');
  const mediaAdminCookie = await login(mediaAdmin.email);
  const mediaAdminResponse = await request('/admin/api/homepage/media', mediaAdminCookie, {
    method: 'POST',
    headers: { origin: baseUrl, 'content-type': 'application/json' },
    body: '{"name":"allowed.png","size":1,"contentType":"image/png"}',
  });
  if (mediaAdminResponse.status === 200) {
    const payload = await mediaAdminResponse.json() as { uploadURL?: unknown; objectPath?: unknown; objectName?: unknown };
    assert.equal(typeof payload.uploadURL, 'object', 'Configured storage must return a signed upload form');
    assert.equal(typeof payload.objectPath, 'string', 'Configured storage must return a public object path');
    assert.equal(typeof payload.objectName, 'string', 'Configured storage must return an object name');
  } else {
    assert.equal(
      mediaAdminResponse.status,
      503,
      `ADMIN media request must pass authorization and reach storage handling, got ${mediaAdminResponse.status}`,
    );
    const payload = await mediaAdminResponse.json() as { error?: unknown };
    const error = typeof payload.error === 'string' ? payload.error : 'Unknown storage failure';
    assert.ok(
      ['Object storage not configured', 'Failed to generate upload URL'].includes(error),
      `Storage failure must return a controlled public error, got ${error}`,
    );
    // Do not print URLs, bucket names, credentials, or the underlying SDK
    // error. This stable event is enough for operational follow-up.
    console.warn('ADMIN_MEDIA_STORAGE_INTEGRATION_UNAVAILABLE', {
      reason: error === 'Object storage not configured' ? 'bucket_configuration_missing' : 'signing_service_unavailable',
    });
  }

  const storageAdminResponse = await request('/admin/api/storage/request-url', mediaAdminCookie, {
    method: 'POST',
    headers: { origin: baseUrl, 'content-type': 'application/json' },
    body: '{"name":"allowed.png","size":1,"contentType":"image/png","namespace":"service-pages"}',
  });
  if (storageAdminResponse.status === 200) {
    const payload = await storageAdminResponse.json() as { uploadURL?: unknown; serveUrl?: unknown };
    assert.equal(typeof payload.uploadURL, 'string', 'Configured storage must return a signed upload URL');
    assert.equal(typeof payload.serveUrl, 'string', 'Configured storage must return a serve URL');
  } else {
    assert.equal(
      storageAdminResponse.status,
      503,
      `Storage signing failure must be controlled 503, got ${storageAdminResponse.status}`,
    );
    const responseText = await storageAdminResponse.text();
    assert.ok(
      responseText.includes('Dosya yükleme hizmeti geçici olarak kullanılamıyor'),
      'Storage failure must return the safe Turkish error message',
    );
    assert.equal(
      /sidecar|127\.0\.0\.1|signed-object-url|ECONN|stack|Storage signing|Error:/i.test(responseText),
      false,
      'Storage failure must not expose internal signing details',
    );
  }

  const inactiveUser = await createTestUser('ADMIN');
  const inactiveCookie = await login(inactiveUser.email);
  await db.update(adminUsers).set({ active: false }).where(eq(adminUsers.id, inactiveUser.id));
  assert.equal((await request('/admin/api/requests', inactiveCookie)).status, 401, 'Deactivated user must be rejected');
  assert.equal(
    (await request('/admin/api/storage/request-url', inactiveCookie, {
      method: 'POST',
      headers: { origin: baseUrl, 'content-type': 'application/json' },
      body: '{"name":"blocked.png","size":1,"contentType":"image/png","namespace":"service-pages"}',
    })).status,
    401,
    'Deactivated user must not mint a storage upload URL',
  );

  console.log('admin authorization E2E tests passed');
} finally {
  if (createdIds.length) {
    await db.delete(adminUsers).where(inArray(adminUsers.id, createdIds));
  }
}