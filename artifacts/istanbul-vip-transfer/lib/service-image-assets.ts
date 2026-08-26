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

/**
 * Our own persistent object storage is served by the separate API artifact at
 * GET /api/storage/objects/{entityId} (see app/admin/api/storage/request-url/route.ts).
 * That route is not guaranteed to be reachable via an unauthenticated, cross-artifact
 * HTTP fetch from this Next.js server, so it must never be used as a reachability
 * probe target — doing so is exactly what caused unrelated saves (e.g. changing a
 * service's category) to fail with a false "image unreachable" error. Paths under
 * this prefix were already validated at upload time (the PUT succeeded against a
 * signed URL), so they are trusted here without a network round trip.
 */
function isOwnObjectStoragePath(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith('/api/storage/objects/')) return true;
  try {
    const url = new URL(trimmed, SITE.siteUrl);
    return url.origin === new URL(SITE.siteUrl).origin && url.pathname.startsWith('/api/storage/objects/');
  } catch {
    return false;
  }
}

/** Returns an absolute, public image URL only when it can actually be fetched. */
export async function getReachableServiceImageUrl(value: string | null | undefined): Promise<string | null> {
  if (!value?.trim() || GENERIC_SERVICE_IMAGES.has(value.trim())) return null;
  const url = absoluteImageUrl(value.trim());
  if (!url) return null;

  // Trust our own object storage without an outbound reachability fetch.
  if (isOwnObjectStoragePath(value.trim())) return url;

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
 *
 * Callers should only invoke this when the field's value has actually changed —
 * an already-saved, previously-accepted image must never be re-validated on
 * every unrelated save (see app/admin/api/service-pages/[id]/route.ts).
 */
export async function validateServiceImageAsset(value: string | null | undefined): Promise<string | null> {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (GENERIC_SERVICE_IMAGES.has(trimmed)) {
    throw new Error('Genel/ortak görsel kullanılamaz; bu hizmete özel bir görsel yükleyin.');
  }
  if (!await getReachableServiceImageUrl(trimmed)) {
    throw new Error(`Görsel URL’sine ulaşılamıyor veya URL bir görsel döndürmüyor: ${trimmed}`);
  }
  return trimmed;
}

/**
 * Resolves an image field for a CMS save without ever letting image
 * validation block an unrelated field change.
 *
 * - If the submitted value is unchanged from what's already stored, the
 *   previously-accepted value is trusted as-is — it is never re-validated
 *   (and never re-fetched) on every save of unrelated fields such as
 *   `category`. This is what caused https://.../hizmetler category edits to
 *   fail with a false "image unreachable" error before this fix.
 * - If it changed, it is validated via `validateServiceImageAsset`. On
 *   failure, the field falls back to the previous stored value and a Turkish
 *   warning (naming the offending URL) is returned instead of throwing, so
 *   the caller can still persist every other field.
 */
export async function resolveImageField(
  newValue: string | null | undefined,
  previousValue: string | null | undefined,
  label: string,
): Promise<{ value: string | null; warning: string | null }> {
  const nextTrimmed = newValue?.trim() || null;
  const prevTrimmed = previousValue?.trim() || null;
  if (nextTrimmed === prevTrimmed) {
    return { value: prevTrimmed, warning: null };
  }
  try {
    const validated = await validateServiceImageAsset(nextTrimmed);
    return { value: validated, warning: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Görsel doğrulanamadı.';
    return { value: prevTrimmed, warning: `${label}: ${message}` };
  }
}