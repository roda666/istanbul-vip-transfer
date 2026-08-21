import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  getAdminApiPermission,
  getAdminPagePermission,
  getCurrentAdminSessionStatus,
  hasAdminPermission,
  hasValidAdminMutationOrigin,
  isCronAdminApi,
  isPublicAdminApi,
} from '../lib/auth/authorization';

function collectRouteFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const file = join(dir, entry);
    return statSync(file).isDirectory() ? collectRouteFiles(file) : (entry === 'route.ts' ? [file] : []);
  });
}

function collectPageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const file = join(dir, entry);
    return statSync(file).isDirectory() ? collectPageFiles(file) : (entry === 'page.tsx' ? [file] : []);
  });
}

function appPath(root: string, file: string): string {
  const path = relative(root, file).split(sep).slice(0, -1)
    .map((segment) => segment.replace(/^\[.+\]$/, 'resource'))
    .join('/');
  return `/${path}`;
}

assert.equal(hasAdminPermission('SUPER_ADMIN', 'STAFF_MANAGE'), true);
assert.equal(hasAdminPermission('ADMIN', 'STAFF_MANAGE'), false);
assert.equal(hasAdminPermission('EDITOR', 'CONTENT_WRITE'), true);
assert.equal(hasAdminPermission('EDITOR', 'CONTENT_PUBLISH'), false);
assert.equal(hasAdminPermission('CHAT_STAFF', 'CHAT_MANAGE'), true);
assert.equal(hasAdminPermission('CHAT_STAFF', 'RESERVATIONS_READ'), false);
assert.equal(hasAdminPermission('UNKNOWN', 'CONTENT_READ'), false);

// Current user data is authoritative: inactive/deleted/stale sessions are 401,
// while an unexpected persisted role is a clean 403.
assert.equal(getCurrentAdminSessionStatus(7, { active: false, role: 'ADMIN', sessionVersion: 7 }), 401);
assert.equal(getCurrentAdminSessionStatus(7, { active: true, role: 'ADMIN', sessionVersion: 6 }), 401);
assert.equal(getCurrentAdminSessionStatus(7, { active: true, role: 'NOT_A_ROLE', sessionVersion: 7 }), 403);
assert.equal(getCurrentAdminSessionStatus(7, { active: true, role: 'SUPER_ADMIN', sessionVersion: 7 }), null);

assert.equal(getAdminApiPermission('/admin/api/staff', 'POST'), 'STAFF_MANAGE');
assert.equal(getAdminApiPermission('/admin/api/homepage/tr/publish', 'POST'), 'CONTENT_PUBLISH');
assert.equal(getAdminApiPermission('/admin/api/vehicles/id', 'DELETE'), 'FLEET_MANAGE');
assert.equal(getAdminApiPermission('/admin/api/requests/id', 'PATCH'), 'RESERVATIONS_MANAGE');
assert.equal(getAdminApiPermission('/admin/api/newsletter/id', 'PATCH'), 'NEWSLETTER_MANAGE');
assert.equal(getAdminApiPermission('/admin/api/translations/ai', 'POST'), 'TRANSLATIONS_MANAGE');
assert.equal(getAdminApiPermission('/admin/api/ai-content/generate', 'POST'), 'AI_USE');
assert.equal(getAdminApiPermission('/admin/api/homepage/media', 'POST'), 'MEDIA_MANAGE');
assert.equal(hasAdminPermission('EDITOR', 'MEDIA_MANAGE'), false);
assert.equal(hasAdminPermission('ADMIN', 'MEDIA_MANAGE'), true);
assert.equal(getAdminApiPermission('/admin/api/studio/projects/id/approve', 'POST'), 'CONTENT_PUBLISH');
assert.equal(getAdminApiPermission('/admin/api/studio/projects/id/publish', 'POST'), 'CONTENT_PUBLISH');
assert.equal(getAdminApiPermission('/admin/api/studio/projects/id/schedule', 'POST'), 'CONTENT_PUBLISH');
assert.equal(getAdminApiPermission('/admin/api/studio/projects/id/schedule', 'GET'), 'AI_USE');
assert.equal(getAdminApiPermission('/admin/api/studio/projects/id', 'DELETE'), 'CONTENT_DELETE');
assert.equal(getAdminApiPermission('/admin/api/unknown', 'GET'), undefined);

assert.equal(getAdminPagePermission('/admin/sohbet'), 'CHAT_MANAGE');
assert.equal(getAdminPagePermission('/admin/personel'), 'STAFF_MANAGE');
assert.equal(getAdminPagePermission('/admin/not-a-real-page'), undefined);

// Inventory guard: every actual admin route and protected page is deliberately
// public/special or assigned a central permission. New files fail this test
// until they are classified.
const apiRoot = join(process.cwd(), 'app/admin/api');
for (const file of collectRouteFiles(apiRoot)) {
  const pathname = appPath(join(process.cwd(), 'app'), file);
  assert.ok(
    isPublicAdminApi(pathname) || isCronAdminApi(pathname) || getAdminApiPermission(pathname, 'POST'),
    `Unmapped admin API route: ${pathname}`,
  );
}

const pageRoot = join(process.cwd(), 'app/admin/(protected)');
for (const file of collectPageFiles(pageRoot)) {
  const pathname = appPath(join(process.cwd(), 'app'), file).replace('/admin/(protected)', '/admin');
  assert.ok(getAdminPagePermission(pathname), `Unmapped protected admin page: ${pathname}`);
}

assert.equal(hasValidAdminMutationOrigin({
  method: 'POST',
  origin: 'https://evil.example',
  secFetchSite: 'cross-site',
  expectedOrigins: ['https://admin.example'],
}), false);
assert.equal(hasValidAdminMutationOrigin({
  method: 'PATCH',
  origin: 'https://admin.example',
  secFetchSite: 'same-origin',
  expectedOrigins: ['https://admin.example'],
}), true);
assert.equal(hasValidAdminMutationOrigin({
  method: 'POST',
  origin: null,
  secFetchSite: null,
  expectedOrigins: ['https://admin.example'],
}), false);

console.log('admin authorization policy tests passed');