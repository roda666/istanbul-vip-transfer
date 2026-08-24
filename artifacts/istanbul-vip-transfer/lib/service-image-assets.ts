import 'server-only';

import { SITE } from '@/lib/site-config';

const GENERIC_SERVICE_IMAGES = new Set([
  SITE.ogImage.url,
  '/images/istanbul-vip-transfer-hero.webp',
  `${SITE.siteUrl}/images/istanbul-vip-transfer-hero.webp`,
]);

function absoluteImageUrl(value: string): string | null {
  try {
    const url = value.startsWith('/') ? new URL(value, SITE.siteUrl) : new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    // Never turn the reachability check into an internal-network request.
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Returns an absolute, public image URL only when it can actually be fetched. */
export async function getReachableServiceImageUrl(value: string | null | undefined): Promise<string | null> {
  if (!value?.trim() || GENERIC_SERVICE_IMAGES.has(value.trim())) return null;
  const url = absoluteImageUrl(value.trim());
  if (!url) return null;

  const request = async (method: 'HEAD' | 'GET') => fetch(url, {
    method,
    headers: method === 'GET' ? { Range: 'bytes=0-0' } : undefined,
    redirect: 'follow',
    signal: AbortSignal.timeout(5_000),
    cache: 'no-store',
  });
  try {
    let response = await request('HEAD');
    // Some object stores do not implement HEAD; a one-byte GET still verifies
    // both public availability and image content type.
    if (response.status === 405 || response.status === 403) response = await request('GET');
    if (!response.ok) return null;
    return response.headers.get('content-type')?.toLowerCase().startsWith('image/') ? url : null;
  } catch {
    return null;
  }
}

/**
 * CMS writes use this gate so a broken URL cannot become a hero or OG source.
 * The generic site card is intentionally rejected: every service needs its own
 * topic-specific asset rather than a shared/default image.
 */
export async function validateServiceImageAsset(value: string | null | undefined): Promise<string | null> {
  if (!value?.trim()) return null;
  if (GENERIC_SERVICE_IMAGES.has(value.trim())) {
    throw new Error('Genel/ortak görsel kullanılamaz; bu hizmete özel bir görsel yükleyin.');
  }
  if (!await getReachableServiceImageUrl(value)) {
    throw new Error('Görsel URL’sine ulaşılamıyor veya URL bir görsel döndürmüyor.');
  }
  return value.trim();
}