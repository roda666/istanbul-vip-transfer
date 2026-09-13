import 'server-only';

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_IMPORTED_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 5;

function privateAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (isIP(normalized) === 4) {
    const octets = normalized.split('.').map(Number);
    return octets[0] === 10
      || octets[0] === 127
      || (octets[0] === 169 && octets[1] === 254)
      || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
      || (octets[0] === 192 && octets[1] === 168)
      || octets[0] === 0;
  }
  if (isIP(normalized) === 6) {
    // IPv4-mapped IPv6 addresses are still IPv4 destinations.
    const mappedV4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    if (mappedV4) return privateAddress(mappedV4);
    const firstHextet = Number.parseInt(normalized.split(':')[0] || '0', 16);
    return normalized === '::1'
      || normalized === '::'
      || (firstHextet >= 0xfc00 && firstHextet <= 0xfdff)
      || (firstHextet >= 0xfe80 && firstHextet <= 0xfebf)
      || (firstHextet >= 0xff00 && firstHextet <= 0xffff);
  }
  return true;
}

export type ImageImportSafetyReason =
  | 'malformed_url'
  | 'non_https'
  | 'credentials'
  | 'localhost'
  | 'ip_literal'
  | 'private_address'
  | 'dns_private'
  | 'dns_unresolved'
  | 'unsafe_redirect'
  | 'bad_mime'
  | 'oversize'
  | 'upstream_error';

export type ImageImportSafetyResult =
  | { ok: true }
  | { ok: false; reason: ImageImportSafetyReason };

export async function classifyPublicHttpsUrl(raw: string): Promise<ImageImportSafetyResult> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'malformed_url' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, reason: 'non_https' };
  if (!parsed.hostname) return { ok: false, reason: 'malformed_url' };
  if (parsed.username || parsed.password) return { ok: false, reason: 'credentials' };
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const hostForIpCheck = hostname.replace(/^\[|\]$/g, '');
  if (
    hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || hostname === 'metadata.google.internal'
  ) return { ok: false, reason: 'localhost' };
  if (isIP(hostForIpCheck)) {
    if (hostForIpCheck === '::1' || hostForIpCheck === '::') {
      return { ok: false, reason: 'localhost' };
    }
    return privateAddress(hostForIpCheck)
      ? { ok: false, reason: 'private_address' }
      : { ok: false, reason: 'ip_literal' };
  }
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0) return { ok: false, reason: 'dns_unresolved' };
    return records.some((record) => privateAddress(record.address))
      ? { ok: false, reason: 'dns_private' }
      : { ok: true };
  } catch {
    return { ok: false, reason: 'dns_unresolved' };
  }
}

export async function isSafePublicHttpsUrl(raw: string): Promise<boolean> {
  return (await classifyPublicHttpsUrl(raw)).ok;
}

async function readBoundedBody(response: Response): Promise<Uint8Array | null> {
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_IMPORTED_IMAGE_BYTES) return null;
  if (!response.body) {
    try {
      const bytes = new Uint8Array(await response.arrayBuffer());
      return bytes.byteLength <= MAX_IMPORTED_IMAGE_BYTES ? bytes : null;
    } catch {
      return null;
    }
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_IMPORTED_IMAGE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(next.value);
    }
  } catch {
    return null;
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function fetchPublicImageSafely(rawUrl: string): Promise<{
  contentType: string;
  bytes: Uint8Array;
} | null> {
  const result = await fetchPublicImageSafelyDetailed(rawUrl);
  return result.ok ? result : null;
}

export async function fetchPublicImageSafelyDetailed(rawUrl: string): Promise<
  | { ok: true; contentType: string; bytes: Uint8Array }
  | { ok: false; reason: ImageImportSafetyReason }
> {
  let url = rawUrl;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const safety = await classifyPublicHttpsUrl(url);
    if (!safety.ok) {
      return { ok: false, reason: redirect > 0 ? 'unsafe_redirect' : safety.reason };
    }
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(30_000),
        headers: { Accept: 'image/jpeg,image/png,image/webp,image/avif' },
      });
    } catch {
      return { ok: false, reason: 'upstream_error' };
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirect === MAX_REDIRECTS) return { ok: false, reason: 'unsafe_redirect' };
      try {
        url = new URL(location, url).toString();
      } catch {
        return { ok: false, reason: 'unsafe_redirect' };
      }
      continue;
    }
    if (!response.ok) return { ok: false, reason: 'upstream_error' };
    const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? '';
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(contentType)) {
      return { ok: false, reason: 'bad_mime' };
    }
    const bytes = await readBoundedBody(response);
    if (!bytes) return { ok: false, reason: 'oversize' };
    return { ok: true, contentType, bytes };
  }
  return { ok: false, reason: 'unsafe_redirect' };
}
