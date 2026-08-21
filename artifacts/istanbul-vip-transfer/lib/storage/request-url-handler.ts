import type { AdminAuditReason } from '@/lib/auth/audit';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const STORAGE_UNAVAILABLE_MESSAGE =
  'Dosya yükleme hizmeti geçici olarak kullanılamıyor. Lütfen daha sonra tekrar deneyin.';
const STORAGE_PATHNAME = '/admin/api/storage/request-url';

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

type AuthenticatedAdmin = {
  adminId: string;
  role: unknown;
};

type AuditInput = {
  adminUserId?: string | null;
  action: 'ADMIN_ACCESS_DENIED' | 'ADMIN_OPERATION_FAILED';
  pathname: string;
  method: string;
  permission?: string;
  reason?: AdminAuditReason;
};

export type StorageRequestUrlHandlerDependencies = {
  requireAdminSession: () => Promise<AuthenticatedAdmin>;
  getSessionErrorStatus: (error: unknown) => 401 | 403 | 503;
  getSessionErrorMessage: (status: 401 | 403 | 503) => string;
  hasMediaPermission: (role: unknown) => boolean;
  writeAudit: (input: AuditInput) => Promise<unknown>;
  getPrivateObjectDir: () => string | undefined;
  signPutUrl: (bucketName: string, objectName: string) => Promise<string>;
  createUuid: () => string;
  logFailure: (event: 'STORAGE_UNAVAILABLE' | 'STORAGE_SIGNING_UNAVAILABLE', details: {
    reason: 'private_object_dir_missing' | 'signing_failed';
  }) => void;
};

function parsePrivateObjectDir(dir: string): { bucketName: string; prefix: string } {
  const cleaned = dir.replace(/^gs:\/\//, '');
  const idx = cleaned.indexOf('/');
  if (idx === -1) return { bucketName: cleaned, prefix: '' };
  return { bucketName: cleaned.slice(0, idx), prefix: cleaned.slice(idx + 1) };
}

function parseSafePrefix(body: {
  namespace?: unknown;
  slug?: unknown;
}): string {
  if (typeof body.namespace === 'string' && body.namespace.trim()) {
    return body.namespace.trim()
      .replace(/[^a-z0-9-/]/gi, '-')
      .toLowerCase()
      .replace(/\/+/g, '/')
      .replace(/^\/|\/$/g, '')
      .slice(0, 80);
  }
  if (typeof body.slug === 'string' && body.slug.trim()) {
    const slug = body.slug.replace(/[^a-z0-9-]/gi, '-').toLowerCase().slice(0, 60);
    return `service-pages/${slug}`;
  }
  return 'uploads';
}

export function createStorageRequestUrlHandler(deps: StorageRequestUrlHandlerDependencies) {
  async function recordFailure(
    adminUserId: string,
    method: string,
    reason: Extract<AdminAuditReason, 'storage_unavailable' | 'storage_signing_failed'>,
  ) {
    await deps.writeAudit({
      adminUserId,
      action: 'ADMIN_OPERATION_FAILED',
      pathname: STORAGE_PATHNAME,
      method,
      permission: 'MEDIA_MANAGE',
      reason,
    });
  }

  return async function handleStorageRequestUrl(req: Request): Promise<Response> {
    let session: AuthenticatedAdmin;
    try {
      session = await deps.requireAdminSession();
    } catch (error) {
      const status = deps.getSessionErrorStatus(error);
      return Response.json({ error: deps.getSessionErrorMessage(status) }, { status });
    }

    if (!deps.hasMediaPermission(session.role)) {
      await deps.writeAudit({
        adminUserId: session.adminId,
        action: 'ADMIN_ACCESS_DENIED',
        pathname: STORAGE_PATHNAME,
        method: req.method,
        permission: 'MEDIA_MANAGE',
        reason: 'permission_denied',
      });
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: {
      name?: unknown;
      size?: unknown;
      contentType?: unknown;
      slug?: unknown;
      namespace?: unknown;
    };
    try {
      body = await req.json() as typeof body;
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (typeof body.name !== 'string' || !body.name) {
      return Response.json({ error: 'name is required' }, { status: 400 });
    }
    if (typeof body.size !== 'number' || body.size <= 0) {
      return Response.json({ error: 'size must be a positive number' }, { status: 400 });
    }
    if (typeof body.contentType !== 'string' || !body.contentType) {
      return Response.json({ error: 'contentType is required' }, { status: 400 });
    }
    if (body.size > MAX_FILE_SIZE) {
      return Response.json({ error: 'Dosya boyutu 10 MB\'ı geçemez' }, { status: 400 });
    }

    const extension = ALLOWED_CONTENT_TYPES[body.contentType];
    if (!extension) {
      return Response.json(
        { error: 'Yalnızca JPEG, PNG, WebP, GIF ve AVIF görseller desteklenir' },
        { status: 400 },
      );
    }

    const privateObjectDir = deps.getPrivateObjectDir();
    if (!privateObjectDir) {
      await recordFailure(session.adminId, req.method, 'storage_unavailable');
      deps.logFailure('STORAGE_UNAVAILABLE', { reason: 'private_object_dir_missing' });
      return Response.json({ error: STORAGE_UNAVAILABLE_MESSAGE }, { status: 503 });
    }

    const safePrefix = parseSafePrefix(body);
    const entityId = `${safePrefix}/${deps.createUuid()}${extension}`;
    const { bucketName, prefix } = parsePrivateObjectDir(privateObjectDir);
    const objectName = [prefix, entityId].filter(Boolean).join('/');

    try {
      const uploadURL = await deps.signPutUrl(bucketName, objectName);
      return Response.json({
        uploadURL,
        serveUrl: `/api/storage/objects/${entityId}`,
        contentType: body.contentType,
      });
    } catch {
      await recordFailure(session.adminId, req.method, 'storage_signing_failed');
      deps.logFailure('STORAGE_SIGNING_UNAVAILABLE', { reason: 'signing_failed' });
      return Response.json({ error: STORAGE_UNAVAILABLE_MESSAGE }, { status: 503 });
    }
  };
}

export { STORAGE_UNAVAILABLE_MESSAGE };