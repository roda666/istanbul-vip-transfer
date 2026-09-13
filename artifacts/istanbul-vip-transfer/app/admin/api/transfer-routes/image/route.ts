import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { generateImageAsset } from '@/lib/studio/ai-studio';
import { fetchPublicImageSafely } from '@/lib/secure-image-import';
import {
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

async function saveImage(
  contentType: string | null,
  bytes: Uint8Array,
  altText: string,
  origin: string,
  destination: string,
) {
  const optimized = await probeAndOptimizeTransferRouteImage(contentType, bytes);
  if (!optimized) return NextResponse.json({
    error: 'Görsel yalnızca geçerli JPEG, PNG, WebP veya AVIF biçiminde ve güvenli boyutlarda kabul edilir.',
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
    if (!(file instanceof File)) return NextResponse.json({ error: 'Görsel dosyası zorunludur.' }, { status: 422 });
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Görsel dosyası 10 MiB sınırını aşamaz.' }, { status: 422 });
    }
    const origin = typeof form.get('origin') === 'string' ? String(form.get('origin')).trim().slice(0, 160) : 'İstanbul';
    const destination = typeof form.get('destination') === 'string' ? String(form.get('destination')).trim().slice(0, 160) : 'Transfer';
    const altText = typeof form.get('altText') === 'string' ? String(form.get('altText')) : '';
    try {
      return await saveImage(file.type, new Uint8Array(await file.arrayBuffer()), altText, origin || 'İstanbul', destination || 'Transfer');
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
    const imported = await fetchPublicImageSafely(sourceUrl);
    if (!imported) return NextResponse.json({ error: 'Güvenli bir HTTPS görsel kaynağı alınamadı.' }, { status: 422 });
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
