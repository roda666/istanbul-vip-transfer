/**
 * Admin-only presigned URL generator for service page image uploads.
 *
 * Two-step flow:
 *  1. POST here with JSON metadata (name, size, contentType, slug) → get { uploadURL, serveUrl }
 *  2. Client PUTs the file directly to uploadURL (GCS presigned), stores serveUrl in DB
 *
 * The GCS object is stored at:  PRIVATE_OBJECT_DIR/service-pages/{slug}/{uuid}{ext}
 *
 * The Express API server resolves GET /api/storage/objects/{entityId} by prepending
 * PRIVATE_OBJECT_DIR automatically.  So the serveUrl returned here uses only the
 * entityId portion (service-pages/{slug}/{uuid}{ext}), NOT the bucket/prefix.
 */
import { NextRequest } from 'next/server';
import {
  getAdminSessionErrorMessage,
  getAdminSessionErrorStatus,
  requireAdminSession,
} from '@/lib/auth/session';
import { hasAdminPermission } from '@/lib/auth/authorization';
import { writeAdminSecurityAudit } from '@/lib/auth/audit';
import { createStorageRequestUrlHandler } from '@/lib/storage/request-url-handler';
import { randomUUID } from 'crypto';
import 'server-only';

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';

async function signPutUrl(bucketName: string, objectName: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(
      `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket_name: bucketName,
          object_name: objectName,
          method: 'PUT',
          expires_at: new Date(Date.now() + 900_000).toISOString(),
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );
  } catch {
    throw new Error('Storage signing unavailable');
  }

  if (!res.ok) {
    // Do not read the response body: the sidecar may return internal details.
    throw new Error('Storage signing unavailable');
  }

  try {
    const data = (await res.json()) as { signed_url?: unknown };
    if (typeof data.signed_url !== 'string' || !data.signed_url) {
      throw new Error('Storage signing response invalid');
    }
    return data.signed_url;
  } catch {
    throw new Error('Storage signing unavailable');
  }
}

const handleStorageRequestUrl = createStorageRequestUrlHandler({
  requireAdminSession,
  getSessionErrorStatus: getAdminSessionErrorStatus,
  getSessionErrorMessage: getAdminSessionErrorMessage,
  hasMediaPermission: (role) => hasAdminPermission(role, 'MEDIA_MANAGE'),
  writeAudit: writeAdminSecurityAudit,
  getPrivateObjectDir: () => process.env.PRIVATE_OBJECT_DIR,
  signPutUrl,
  createUuid: randomUUID,
  logFailure: (event, details) => console.error(event, details),
});

export async function POST(req: NextRequest) {
  return handleStorageRequestUrl(req);
}
