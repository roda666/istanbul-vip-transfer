/**
 * POST /admin/api/homepage/media — generate a presigned GCS upload URL for hero images.
 *
 * Request:  { name: string; size: number; contentType: string }
 * Response: { uploadURL: string; objectPath: string }
 *
 * Uses the same GCS bucket provisioned by setupObjectStorage().
 * MIME types restricted to JPEG, PNG, WebP, AVIF.
 * Max file size: 10 MB.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const schema = z.object({
  name:        z.string().min(1).max(255),
  size:        z.number().int().positive().max(MAX_BYTES),
  contentType: z.string().refine(v => ALLOWED_MIME.includes(v), {
    message: `Allowed types: ${ALLOWED_MIME.join(', ')}`,
  }),
});

export async function POST(req: NextRequest) {
  try { await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Validation error' }, { status: 422 });
  }

  const { size, contentType } = parsed.data;

  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) {
    return NextResponse.json({ error: 'Object storage not configured' }, { status: 503 });
  }

  try {
    const { Storage } = await import('@google-cloud/storage');
    const storage = new Storage();
    const bucket  = storage.bucket(bucketId);

    // Generate a unique object name
    const ext = contentType === 'image/jpeg' ? 'jpg'
              : contentType === 'image/png'  ? 'png'
              : contentType === 'image/webp' ? 'webp'
              : 'avif';
    const objectName = `homepage/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const file = bucket.file(objectName);

    const [uploadURL] = await file.generateSignedPostPolicyV4({
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      conditions: [
        ['content-length-range', 1, size],
        ['eq', '$Content-Type', contentType],
      ],
      fields: { 'Content-Type': contentType },
    });

    // The public-serving path we'll store in DB / return to the editor
    const objectPath = `https://storage.googleapis.com/${bucketId}/${objectName}`;

    return NextResponse.json({ uploadURL, objectPath, objectName });
  } catch (err) {
    console.error('Presigned URL error:', err);
    // Fallback: return error but don't crash the editor
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 503 });
  }
}
