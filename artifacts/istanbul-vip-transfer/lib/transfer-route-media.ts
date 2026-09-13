import 'server-only';

import { optimizeGeneratedImage } from '@/lib/studio/image-media';

const MAX_ROUTE_IMAGE_BYTES = 10 * 1024 * 1024;
const ROUTE_IMAGE_PATH_PATTERN =
  /^\/api\/storage\/objects\/transfer-routes\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/;
const LEGACY_LOCAL_IMAGE_PATTERN =
  /^\/(?:route-images|hero-images|images)\/[a-z0-9._/-]+$/i;

export type RouteImageProbe = {
  bytes: Uint8Array;
  contentType: 'image/webp';
};

export function isValidTransferRouteImagePath(value: unknown): value is string {
  return typeof value === 'string'
    && (ROUTE_IMAGE_PATH_PATTERN.test(value) || LEGACY_LOCAL_IMAGE_PATTERN.test(value));
}

export function normalizeRouteImageAltText(value: unknown, fallback: string): string {
  const alt = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return (alt || fallback).slice(0, 300);
}

function declaredFormat(contentType: string | null): 'jpeg' | 'png' | 'webp' | 'avif' | null {
  const mime = contentType?.split(';', 1)[0].trim().toLowerCase();
  if (mime === 'image/jpeg') return 'jpeg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/avif') return 'avif';
  return null;
}

/**
 * Sharp both probes the bytes and decodes them, which prevents a claimed MIME
 * type or filename from bypassing the permanent-storage format policy.
 */
export async function probeAndOptimizeTransferRouteImage(
  contentType: string | null,
  bytes: Uint8Array,
): Promise<RouteImageProbe | null> {
  const expected = declaredFormat(contentType);
  if (!expected || bytes.byteLength === 0 || bytes.byteLength > MAX_ROUTE_IMAGE_BYTES) return null;
  try {
    const sharp = (await import('sharp')).default;
    const source = sharp(Buffer.from(bytes), {
      failOn: 'error',
      limitInputPixels: 40_000_000,
      sequentialRead: true,
    });
    const metadata = await source.metadata();
    if (!metadata.width || !metadata.height || metadata.format !== expected) return null;
    const optimized = await optimizeGeneratedImage(bytes);
    if (!optimized) return null;
    // Permanent route assets use one exact contract, including small uploads:
    // cover-crop and enlarge as needed rather than leaving a smaller WebP.
    const exact = await sharp(Buffer.from(optimized), {
      failOn: 'error',
      limitInputPixels: 40_000_000,
    }).rotate().resize({
      width: 1_600,
      height: 900,
      fit: 'cover',
      position: 'centre',
    }).webp({ quality: 82, effort: 5, smartSubsample: true }).toBuffer();
    const output = await sharp(exact, {
      failOn: 'error',
      limitInputPixels: 40_000_000,
    }).metadata();
    if (
      output.format !== 'webp'
      || !output.width
      || !output.height
      || output.width !== 1_600
      || output.height !== 900
      || output.width > 1_600
      || output.height > 900
      || exact.byteLength > MAX_ROUTE_IMAGE_BYTES
    ) return null;
    return { bytes: new Uint8Array(exact), contentType: 'image/webp' };
  } catch {
    return null;
  }
}

function parsePrivateObjectDir(dir: string) {
  const cleaned = dir.replace(/^gs:\/\//, '');
  if (cleaned.startsWith('/')) {
    const bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID?.trim() ?? '';
    return { bucket, prefix: cleaned.replace(/^\/+/, '') };
  }
  const slash = cleaned.indexOf('/');
  return slash < 0
    ? { bucket: cleaned, prefix: '' }
    : { bucket: cleaned.slice(0, slash), prefix: cleaned.slice(slash + 1) };
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const { buffer, byteOffset, byteLength } = bytes;
  if (buffer instanceof ArrayBuffer) {
    return byteOffset === 0 && byteLength === buffer.byteLength
      ? buffer
      : buffer.slice(byteOffset, byteOffset + byteLength);
  }
  return Uint8Array.from(bytes).buffer;
}

export async function storeTransferRouteImage(
  entityId: string,
  bytes: Uint8Array,
): Promise<{ ok: true; path: string } | { ok: false; message: string }> {
  const privateDir = process.env.PRIVATE_OBJECT_DIR?.trim();
  if (!privateDir) return { ok: false, message: 'Görsel depolama hizmeti yapılandırılmamış.' };
  const { bucket, prefix } = parsePrivateObjectDir(privateDir);
  if (!bucket || !/^[a-zA-Z0-9._/-]+$/.test(entityId)) {
    return { ok: false, message: 'Görsel depolama yapılandırması geçersiz.' };
  }
  try {
    const sign = await fetch(
      `${process.env.REPLIT_SIDECAR_ENDPOINT ?? 'http://127.0.0.1:1106'}/object-storage/signed-object-url`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket_name: bucket,
          object_name: [prefix, entityId].filter(Boolean).join('/'),
          method: 'PUT',
          expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!sign.ok) return { ok: false, message: 'Görsel depolama imzası alınamadı.' };
    const signed = await sign.json() as { signed_url?: unknown };
    if (typeof signed.signed_url !== 'string') return { ok: false, message: 'Görsel depolama imzası geçersiz.' };
    const upload = await fetch(signed.signed_url, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/webp', 'Content-Length': String(bytes.byteLength) },
      body: exactArrayBuffer(bytes),
      signal: AbortSignal.timeout(60_000),
    });
    if (!upload.ok) return { ok: false, message: 'Görsel depolamaya kaydedilemedi.' };
    return { ok: true, path: `/api/storage/objects/${entityId}` };
  } catch {
    return { ok: false, message: 'Görsel depolama hizmetine ulaşılamadı.' };
  }
}
