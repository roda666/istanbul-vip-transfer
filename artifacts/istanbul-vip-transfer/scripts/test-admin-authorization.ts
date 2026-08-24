import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  ADMIN_PERMISSIONS,
  getAdminApiPermission,
  getAdminAuthFailureStatus,
  getAdminPagePermission,
  getCurrentAdminSessionStatus,
  hasAdminPermission,
  hasValidAdminMutationOrigin,
  isCronAdminApi,
  isPublicAdminApi,
} from '../lib/auth/authorization';
import {
  createAdminSecurityAuditWriter,
  normalizeAdminAuditPath,
} from '../lib/auth/audit';
import {
  getAdminSessionErrorMessage,
  getAdminSessionErrorStatus,
} from '../lib/auth/session';
import {
  createStorageRequestUrlHandler,
  STORAGE_UNAVAILABLE_MESSAGE,
  type StorageRequestUrlHandlerDependencies,
} from '../lib/storage/request-url-handler';

const ROLE_EXPECTATIONS = {
  SUPER_ADMIN: new Set(ADMIN_PERMISSIONS),
  ADMIN: new Set([
    'ADMIN_ACCESS', 'DASHBOARD_READ', 'CONTENT_READ', 'CONTENT_WRITE',
    'CONTENT_PUBLISH', 'CONTENT_DELETE', 'AI_USE', 'TRANSLATIONS_MANAGE',
    'FLEET_MANAGE', 'RESERVATIONS_READ', 'RESERVATIONS_MANAGE',
    'NEWSLETTER_READ', 'NEWSLETTER_MANAGE', 'CHAT_MANAGE', 'ANALYTICS_READ',
    'SITE_SETTINGS_MANAGE', 'MEDIA_MANAGE', 'AUDIT_READ', 'ACCOUNT_SELF_MANAGE',
  ]),
  EDITOR: new Set([
    'ADMIN_ACCESS', 'DASHBOARD_READ', 'CONTENT_READ', 'CONTENT_WRITE',
    'AI_USE', 'TRANSLATIONS_MANAGE', 'ACCOUNT_SELF_MANAGE',
  ]),
  CHAT_STAFF: new Set(['CHAT_MANAGE', 'ACCOUNT_SELF_MANAGE']),
} as const;

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

function exportedHttpMethods(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const methods = new Set<string>();
  const pattern = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b|export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=/g;
  for (const match of source.matchAll(pattern)) {
    methods.add(match[1] ?? match[2]);
  }
  return [...methods];
}

// Lock the complete four-role matrix, not just representative permissions.
for (const [role, expectedPermissions] of Object.entries(ROLE_EXPECTATIONS)) {
  for (const permission of ADMIN_PERMISSIONS) {
    assert.equal(
      hasAdminPermission(role, permission),
      expectedPermissions.has(permission),
      `${role} permission mismatch for ${permission}`,
    );
  }
}
assert.equal(hasAdminPermission('UNKNOWN', 'CONTENT_READ'), false);

// Current user data is authoritative: inactive/deleted/stale sessions are 401,
// while an unexpected persisted role is a clean 403.
assert.equal(getCurrentAdminSessionStatus(7, { active: false, role: 'ADMIN', sessionVersion: 7 }), 401);
assert.equal(getCurrentAdminSessionStatus(7, { active: true, role: 'ADMIN', sessionVersion: 6 }), 401);
assert.equal(getCurrentAdminSessionStatus(7, { active: true, role: 'NOT_A_ROLE', sessionVersion: 7 }), 403);
assert.equal(getCurrentAdminSessionStatus(7, { active: true, role: 'SUPER_ADMIN', sessionVersion: 7 }), null);
assert.equal(getAdminAuthFailureStatus('unauthenticated'), 401);
assert.equal(getAdminAuthFailureStatus('forbidden'), 403);
assert.equal(getAdminAuthFailureStatus('unavailable'), 503);
assert.equal(getAdminSessionErrorStatus(Object.assign(new Error('no session'), { status: 401 })), 401);
assert.equal(getAdminSessionErrorStatus(Object.assign(new Error('bad role'), { status: 403 })), 403);
assert.equal(getAdminSessionErrorStatus(Object.assign(new Error('db unavailable'), { status: 503 })), 503);
assert.equal(getAdminSessionErrorStatus(new Error('unknown failure')), 401);
assert.equal(getAdminSessionErrorMessage(403), 'Forbidden');
assert.equal(getAdminSessionErrorMessage(503), 'Authentication service unavailable');

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
assert.equal(getAdminApiPermission('/admin/api/ek-hizmetler', 'GET'), 'SITE_SETTINGS_MANAGE');
assert.equal(getAdminApiPermission('/admin/api/location-distance', 'POST'), 'FLEET_MANAGE');
assert.equal(getAdminApiPermission('/admin/api/turnstile-settings', 'PUT'), 'SECURITY_SETTINGS_MANAGE');
assert.equal(getAdminApiPermission('/admin/api/competitors/analyze', 'POST'), 'AI_USE');
assert.equal(getAdminApiPermission('/admin/api/unknown', 'GET'), undefined);

assert.equal(getAdminPagePermission('/admin/sohbet'), 'CHAT_MANAGE');
assert.equal(getAdminPagePermission('/admin/personel'), 'STAFF_MANAGE');
assert.equal(getAdminPagePermission('/admin/ek-hizmetler'), 'SITE_SETTINGS_MANAGE');
assert.equal(getAdminPagePermission('/admin/ayarlar/guvenlik'), 'SECURITY_SETTINGS_MANAGE');
assert.equal(getAdminPagePermission('/admin/rakipler'), 'AI_USE');
assert.equal(getAdminPagePermission('/admin/not-a-real-page'), undefined);

// Inventory guard: every actual admin route method is deliberately public,
// special, or assigned a central permission. New route handlers or methods
// fail this test until they are classified.
const apiRoot = join(process.cwd(), 'app/admin/api');
for (const file of collectRouteFiles(apiRoot)) {
  const pathname = appPath(join(process.cwd(), 'app'), file);
  const methods = exportedHttpMethods(file);
  assert.ok(methods.length > 0, `No HTTP method export found: ${pathname}`);
  for (const method of methods) {
    assert.ok(
      isPublicAdminApi(pathname) || isCronAdminApi(pathname) || getAdminApiPermission(pathname, method),
      `Unmapped admin API route method: ${method} ${pathname}`,
    );
  }
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

// Audit writes have a success result and a non-throwing, observable failure
// result. Both record/log shapes intentionally contain only allowlisted data.
const storedAuditRecords: Array<Record<string, unknown>> = [];
const successfulAuditWriter = createAdminSecurityAuditWriter(async (record) => {
  storedAuditRecords.push(record as unknown as Record<string, unknown>);
});
const auditSuccess = await successfulAuditWriter({
  adminUserId: '00000000-0000-0000-0000-000000000001',
  action: 'ADMIN_ACCESS_DENIED',
  pathname: '/admin/api/staff',
  method: 'post',
  permission: 'STAFF_MANAGE',
  reason: 'permission_denied',
});
assert.equal(auditSuccess.ok, true);
assert.equal(storedAuditRecords.length, 1);
assert.deepEqual(
  Object.keys((storedAuditRecords[0].metadata ?? {}) as Record<string, unknown>).sort(),
  ['auditAttemptId', 'method', 'permission', 'reason'],
);
const storageAuditFailure = await successfulAuditWriter({
  action: 'ADMIN_OPERATION_FAILED',
  pathname: '/admin/api/storage/request-url',
  method: 'POST',
  permission: 'MEDIA_MANAGE',
  reason: 'storage_signing_failed',
});
assert.equal(storageAuditFailure.ok, true);

const auditFailures: Array<{ event: string; details: Record<string, unknown> }> = [];
const failingAuditWriter = createAdminSecurityAuditWriter(
  async () => { throw new Error('database connection unavailable'); },
  (event, details) => auditFailures.push({ event, details }),
);
const auditFailure = await failingAuditWriter({
  action: 'ADMIN_MUTATION_AUTHORIZED',
  pathname: '/admin/api/homepage/media',
  method: 'POST',
  permission: 'MEDIA_MANAGE',
});
assert.equal(auditFailure.ok, false);
assert.equal(auditFailure.code, 'AUDIT_WRITE_FAILED');
assert.equal(auditFailures.length, 1);
assert.equal(auditFailures[0].event, 'ADMIN_AUDIT_WRITE_FAILED');
assert.deepEqual(
  Object.keys(auditFailures[0].details).sort(),
  ['action', 'attemptId', 'errorClass', 'method', 'pathname', 'permission', 'reason'],
);
assert.equal(auditFailures[0].details.errorClass, 'Error');

// A failed reporting sink must not turn an audit failure into a request error.
const loggerFailureWriter = createAdminSecurityAuditWriter(
  async () => { throw new Error('database connection unavailable'); },
  () => { throw new Error('log collector unavailable'); },
);
const loggerFailureResult = await loggerFailureWriter({
  action: 'ADMIN_ACCESS_DENIED',
  pathname: '/admin/api/staff',
  method: 'GET',
});
assert.equal(loggerFailureResult.ok, false);
if (!loggerFailureResult.ok) {
  assert.equal(loggerFailureResult.code, 'AUDIT_WRITE_FAILED');
}

// Dynamic URL parameters and query strings are request-controlled and must
// never become audit metadata or an operational log field.
const adversarialPath = '/admin/api/not-a-real-module/token-do-not-record?credential=also-do-not-record';
assert.equal(normalizeAdminAuditPath(adversarialPath), '/admin/api/unknown');
const adversarialAuditRecords: Array<Record<string, unknown>> = [];
const redactingAuditWriter = createAdminSecurityAuditWriter(async (record) => {
  adversarialAuditRecords.push(record as unknown as Record<string, unknown>);
});
await redactingAuditWriter({
  action: 'ADMIN_ACCESS_DENIED',
  pathname: adversarialPath,
  method: 'POST',
  reason: 'unmapped_admin_route',
});
assert.equal(adversarialAuditRecords[0].pathname, '/admin/api/unknown');
assert.equal(JSON.stringify(adversarialAuditRecords[0]).includes('token-do-not-record'), false);
assert.equal(JSON.stringify(adversarialAuditRecords[0]).includes('credential='), false);

type StorageAuditEvent = {
  adminUserId?: string | null;
  action: string;
  pathname: string;
  method: string;
  permission?: string;
  reason?: string;
};

function storagePost(body: Record<string, unknown>) {
  return new Request('http://test.local/admin/api/storage/request-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createStorageHandler(
  overrides: Partial<StorageRequestUrlHandlerDependencies> = {},
) {
  const audits: StorageAuditEvent[] = [];
  const logs: Array<{ event: string; details: Record<string, unknown> }> = [];
  const deps: StorageRequestUrlHandlerDependencies = {
    requireAdminSession: async () => ({ adminId: 'test-admin-id', role: 'ADMIN' }),
    getSessionErrorStatus: getAdminSessionErrorStatus,
    getSessionErrorMessage: getAdminSessionErrorMessage,
    hasMediaPermission: (role) => role === 'ADMIN' || role === 'SUPER_ADMIN',
    writeAudit: async (input) => { audits.push(input); },
    getPrivateObjectDir: () => 'test-bucket/private',
    signPutUrl: async () => 'https://upload.example.test/signed',
    createUuid: () => '00000000-0000-0000-0000-000000000002',
    logFailure: (event, details) => logs.push({ event, details }),
    ...overrides,
  };
  return { handler: createStorageRequestUrlHandler(deps), audits, logs };
}

const safeUploadRequest = {
  name: 'photo.png',
  size: 1,
  contentType: 'image/png',
  namespace: 'service-pages',
};

const successfulStorageHandler = createStorageHandler();
const successfulStorageResponse = await successfulStorageHandler.handler(storagePost(safeUploadRequest));
assert.equal(successfulStorageResponse.status, 200);
assert.deepEqual(await successfulStorageResponse.json(), {
  uploadURL: 'https://upload.example.test/signed',
  serveUrl: '/api/storage/objects/service-pages/00000000-0000-0000-0000-000000000002.png',
  contentType: 'image/png',
});

const missingConfigHandler = createStorageHandler({
  getPrivateObjectDir: () => undefined,
  signPutUrl: async () => { throw new Error('signer must not run without config'); },
});
const missingConfigResponse = await missingConfigHandler.handler(storagePost({
  ...safeUploadRequest,
  namespace: 'sidecar-token-do-not-record',
}));
assert.equal(missingConfigResponse.status, 503);
assert.deepEqual(await missingConfigResponse.json(), { error: STORAGE_UNAVAILABLE_MESSAGE });
assert.deepEqual(missingConfigHandler.audits, [{
  adminUserId: 'test-admin-id',
  action: 'ADMIN_OPERATION_FAILED',
  pathname: '/admin/api/storage/request-url',
  method: 'POST',
  permission: 'MEDIA_MANAGE',
  reason: 'storage_unavailable',
}]);
assert.deepEqual(missingConfigHandler.logs, [{
  event: 'STORAGE_UNAVAILABLE',
  details: { reason: 'private_object_dir_missing' },
}]);
assert.equal(JSON.stringify(missingConfigHandler.audits).includes('sidecar-token-do-not-record'), false);

const failingSignerHandler = createStorageHandler({
  signPutUrl: async () => { throw new Error('sidecar internal token=do-not-record'); },
});
const failingSignerResponse = await failingSignerHandler.handler(storagePost(safeUploadRequest));
assert.equal(failingSignerResponse.status, 503);
assert.deepEqual(await failingSignerResponse.json(), { error: STORAGE_UNAVAILABLE_MESSAGE });
assert.equal(failingSignerHandler.audits[0]?.reason, 'storage_signing_failed');
assert.deepEqual(failingSignerHandler.logs, [{
  event: 'STORAGE_SIGNING_UNAVAILABLE',
  details: { reason: 'signing_failed' },
}]);
assert.equal(JSON.stringify(failingSignerHandler.audits).includes('token=do-not-record'), false);
assert.equal(JSON.stringify(failingSignerHandler.logs).includes('token=do-not-record'), false);

const deniedStorageHandler = createStorageHandler({
  requireAdminSession: async () => ({ adminId: 'editor-id', role: 'EDITOR' }),
});
const deniedStorageResponse = await deniedStorageHandler.handler(storagePost(safeUploadRequest));
assert.equal(deniedStorageResponse.status, 403);
assert.equal(deniedStorageHandler.audits[0]?.action, 'ADMIN_ACCESS_DENIED');
assert.equal(deniedStorageHandler.audits[0]?.reason, 'permission_denied');

for (const expectedStatus of [401, 403, 503] as const) {
  const sessionFailureHandler = createStorageHandler({
    requireAdminSession: async () => {
      throw Object.assign(new Error('internal session error'), { status: expectedStatus });
    },
  });
  const response = await sessionFailureHandler.handler(storagePost(safeUploadRequest));
  assert.equal(response.status, expectedStatus, `Handler must preserve ${expectedStatus} session status`);
}

console.log('admin authorization policy tests passed');