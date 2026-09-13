import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { generateImageAsset } from '@/lib/studio/ai-studio';
import { fetchPublicImageSafelyDetailed, type ImageImportSafetyReason } from '@/lib/secure-image-import';
import {
  deleteTransferRouteImageObject,
  isStrictTransferRouteImagePath,
  normalizeRouteImageAltText,
  probeAndOptimizeTransferRouteImage,
  storeTransferRouteImage,
} from '@/lib/transfer-route-media';

export const dynamic = 'force-dynamic';

function slugPart(value: string): string {
  return value.toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'rota';
}

function upstreamStatus(reason: string): number {
  if (reason === 'not_configured') return 503;
  if (reason === 'credit_exhausted') return 402;
  if (reason === 'rate_limited') return 429;
  return 502;
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

function isBrowserFileLike(value: unknown): value is {
  size: number;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
} {
  return !!value
    && typeof value === 'object'
    && typeof (value as { arrayBuffer?: unknown }).arrayBuffer === 'function'
    && typeof (value as { size?: unknown }).size === 'number'
    && Number.isFinite((value as { size: number }).size)
    && typeof (value as { type?: unknown }).type === 'string';
}

function uploadMimeError(type: string): string | null {
  const mime = type.split(';', 1)[0].trim().toLowerCase();
  return ACCEPTED_MIME_TYPES.has(mime)
    ? null
    : 'Görsel MIME türü JPG, PNG, WebP veya AVIF olmalıdır.';
}

function importedImageError(reason: ImageImportSafetyReason): string {
  switch (reason) {
    case 'non_https': return 'Görsel URL yalnızca HTTPS olabilir.';
    case 'localhost': return 'Yerel veya dahili görsel adresleri kabul edilmez.';
    case 'ip_literal':
    case 'private_address':
    case 'dns_private': return 'Özel, yerel veya link-local ağ adreslerine erişilemez.';
    case 'unsafe_redirect': return 'Görsel URL güvenli olmayan bir yönlendirme içeriyor.';
    case 'bad_mime': return 'Kaynak yalnızca JPG, PNG, WebP veya AVIF görseli döndürmelidir.';
    case 'oversize': return 'İçe aktarılan görsel 10 MiB sınırını aşamaz.';
    case 'credentials': return 'Kullanıcı adı veya parola içeren görsel URL kabul edilmez.';
    case 'malformed_url': return 'Geçersiz görsel URL değeri.';
    case 'dns_unresolved': return 'Görsel adresi çözümlenemedi.';
    default: return 'Güvenli görsel kaynağına ulaşılamadı.';
  }
}

async function saveImage(
  contentType: string | null,
  bytes: Uint8Array,
  altText: string,
  origin: string,
  destination: string,
) {
  const optimized = await probeAndOptimizeTransferRouteImage(contentType, bytes);
  if (!optimized) return NextResponse.json({
    error: 'Görsel MIME bildirimi ile gerçek dosya biçimi uyuşmuyor veya görsel bozuk.',
  }, { status: 422 });
  const stored = await storeTransferRouteImage(
    `transfer-routes/${slugPart(`${origin}-${destination}`)}/${crypto.randomUUID()}.webp`,
    optimized.bytes,
  );
  if (!stored.ok) return NextResponse.json({ error: stored.message }, { status: 503 });
  const image = {
    imagePath: stored.path,
    altText: normalizeRouteImageAltText(altText, `${origin} - ${destination} VIP transfer`),
  };
  return NextResponse.json({
    ...image,
    image,
  }, { status: 201 });
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contentType = req.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType.startsWith('multipart/form-data')) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Geçersiz multipart görsel isteği.' }, { status: 400 });
    }
    const file = form.get('file');
    if (!isBrowserFileLike(file)) return NextResponse.json({ error: 'Görsel dosyası zorunludur.' }, { status: 422 });
    const mimeError = uploadMimeError(file.type);
    if (mimeError) return NextResponse.json({ error: mimeError }, { status: 422 });
    if (file.size <= 0) {
      return NextResponse.json({ error: 'Görsel dosyası boş olamaz.' }, { status: 422 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'Görsel dosyası 10 MiB sınırını aşamaz.' }, { status: 422 });
    }
    const origin = typeof form.get('origin') === 'string' ? String(form.get('origin')).trim().slice(0, 160) : 'İstanbul';
    const destination = typeof form.get('destination') === 'string' ? String(form.get('destination')).trim().slice(0, 160) : 'Transfer';
    const altText = typeof form.get('altText') === 'string' ? String(form.get('altText')) : '';
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.byteLength > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: 'Görsel dosyası 10 MiB sınırını aşamaz.' }, { status: 422 });
      }
      if (bytes.byteLength === 0) {
        return NextResponse.json({ error: 'Görsel dosyası boş olamaz.' }, { status: 422 });
      }
      return await saveImage(file.type, bytes, altText, origin || 'İstanbul', destination || 'Transfer');
    } catch {
      return NextResponse.json({ error: 'Görsel güvenli biçimde işlenemedi.' }, { status: 422 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }
  const origin = typeof body.origin === 'string' ? body.origin.trim().slice(0, 160) : 'İstanbul';
  const destination = typeof body.destination === 'string' ? body.destination.trim().slice(0, 160) : 'Transfer';
  const altText = typeof body.altText === 'string' ? body.altText : '';
  const sourceUrl = body.action === 'import-url'
    ? (typeof body.url === 'string'
      ? body.url
      : typeof body.sourceUrl === 'string' ? body.sourceUrl : null)
    : null;
  if (body.action === 'import-url' && !sourceUrl) {
    return NextResponse.json({ error: 'import-url için HTTPS görsel URL değeri zorunludur.' }, { status: 422 });
  }
  if (sourceUrl) {
    const imported = await fetchPublicImageSafelyDetailed(sourceUrl);
    if (!imported.ok) return NextResponse.json({ error: importedImageError(imported.reason) }, { status: 422 });
    try {
      return await saveImage(imported.contentType, imported.bytes, altText, origin || 'İstanbul', destination || 'Transfer');
    } catch {
      return NextResponse.json({ error: 'Görsel güvenli biçimde işlenemedi.' }, { status: 422 });
    }
  }

  if (body.action !== 'generate') {
    return NextResponse.json({ error: 'generate, multipart upload veya sourceUrl zorunludur.' }, { status: 422 });
  }
  const safeOrigin = origin || 'İstanbul';
  const safeDestination = destination || 'Transfer';
  const generated = await generateImageAsset({
    prompt: `Realistic premium chauffeur transfer vehicle serving ${safeOrigin} to ${safeDestination}, elegant Istanbul travel atmosphere, refined neutral colors, wide cinematic 16:9 composition`,
    altText: normalizeRouteImageAltText(altText, `${safeOrigin} - ${safeDestination} VIP transfer`),
  });
  if (!generated.ok) return NextResponse.json({ error: generated.message }, { status: upstreamStatus(generated.reason) });
  return saveImage(
    'image/webp',
    generated.data.bytes,
    generated.data.altText,
    safeOrigin,
    safeDestination,
  );
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }
  const imagePath = typeof body.imagePath === 'string'
    ? body.imagePath
    : typeof body.path === 'string' ? body.path : '';
  if (!isStrictTransferRouteImagePath(imagePath)) {
    return NextResponse.json({ error: 'Yalnızca geçerli transfer rota görsel yolu silinebilir.' }, { status: 422 });
  }

  const referenced = await (async () => {
    const { db } = await import('@/db');
    const { transferRoutes } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    return db.select({ id: transferRoutes.id }).from(transferRoutes)
      .where(eq(transferRoutes.imagePath, imagePath)).limit(1);
  })();
  if (referenced.length) {
    return NextResponse.json({ error: 'Görsel en az bir rota tarafından kullanılıyor.', referenced: true }, { status: 409 });
  }

  const deleted = await deleteTransferRouteImageObject(imagePath);
  if (!deleted.ok && deleted.reason === 'not_found') {
    return NextResponse.json({ ok: true, deleted: false, notFound: true });
  }
  if (!deleted.ok) {
    return NextResponse.json({ error: 'Görsel nesnesi silinemedi.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, deleted: true });
}
