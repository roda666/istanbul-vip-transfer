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
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { randomUUID } from 'crypto';
import 'server-only';

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg':  '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/gif':  '.gif',
  'image/avif': '.avif',
};

/**
 * Parse PRIVATE_OBJECT_DIR (e.g. "bucket-id/private" or "gs://bucket-id/private")
 * into { bucketName, prefix }.
 */
function parsePrivateObjectDir(dir: string): { bucketName: string; prefix: string } {
  const cleaned = dir.replace(/^gs:\/\//, '');
  const idx = cleaned.indexOf('/');
  if (idx === -1) return { bucketName: cleaned, prefix: '' };
  return { bucketName: cleaned.slice(0, idx), prefix: cleaned.slice(idx + 1) };
}

async function signPutUrl(bucketName: string, objectName: string): Promise<string> {
  const res = await fetch(
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
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Sidecar signing error ${res.status}: ${body}`);
  }
  const data = (await res.json()) as { signed_url: string };
  return data.signed_url;
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { name?: unknown; size?: unknown; contentType?: unknown; slug?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, size, contentType, slug } = body;

  if (typeof name !== 'string' || !name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (typeof size !== 'number' || size <= 0) {
    return NextResponse.json({ error: 'size must be a positive number' }, { status: 400 });
  }
  if (typeof contentType !== 'string' || !contentType) {
    return NextResponse.json({ error: 'contentType is required' }, { status: 400 });
  }

  // Server-side validations
  if (size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: `Dosya boyutu 10 MB'ı geçemez` }, { status: 400 });
  }
  const ext = ALLOWED_CONTENT_TYPES[contentType];
  if (!ext) {
    return NextResponse.json(
      { error: 'Yalnızca JPEG, PNG, WebP, GIF ve AVIF görseller desteklenir' },
      { status: 400 },
    );
  }

  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateObjectDir) {
    return NextResponse.json({ error: 'Object storage yapılandırılmamış' }, { status: 503 });
  }

  const uuid = randomUUID();
  const safeslug = (typeof slug === 'string' ? slug : 'service')
    .replace(/[^a-z0-9-]/gi, '-')
    .toLowerCase()
    .slice(0, 60);

  // entityId is the path relative to PRIVATE_OBJECT_DIR — used in the serving URL
  const entityId = `service-pages/${safeslug}/${uuid}${ext}`;

  const { bucketName, prefix } = parsePrivateObjectDir(privateObjectDir);
  // Full GCS object name = prefix + entityId  (prefix may be empty)
  const objectName = [prefix, entityId].filter(Boolean).join('/');

  try {
    const uploadURL = await signPutUrl(bucketName, objectName);

    // The Express API server resolves /api/storage/objects/{entityId} by prepending PRIVATE_OBJECT_DIR.
    // DO NOT include bucket or prefix in the serve URL — the storage handler adds them internally.
    const serveUrl = `/api/storage/objects/${entityId}`;

    return NextResponse.json({ uploadURL, serveUrl, contentType });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[storage/request-url]', msg);
    return NextResponse.json({ error: `Yükleme URL oluşturulamadı: ${msg}` }, { status: 500 });
  }
}
