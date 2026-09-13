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
    return normalized === '::1'
      || normalized === '::'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe80:');
  }
  return true;
}

export async function isSafePublicHttpsUrl(raw: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) return false;
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const hostForIpCheck = hostname.replace(/^\[|\]$/g, '');
  if (
    hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || hostname === 'metadata.google.internal'
    || isIP(hostForIpCheck)
  ) return false;
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    return records.length > 0 && records.every((record) => !privateAddress(record.address));
  } catch {
    return false;
  }
}

async function readBoundedBody(response: Response): Promise<Uint8Array | null> {
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_IMPORTED_IMAGE_BYTES) return null;
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength <= MAX_IMPORTED_IMAGE_BYTES ? bytes : null;
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
  let url = rawUrl;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    if (!(await isSafePublicHttpsUrl(url))) return null;
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(30_000),
        headers: { Accept: 'image/jpeg,image/png,image/webp,image/avif' },
      });
    } catch {
      return null;
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirect === MAX_REDIRECTS) return null;
      try {
        url = new URL(location, url).toString();
      } catch {
        return null;
      }
      continue;
    }
    if (!response.ok) return null;
    const bytes = await readBoundedBody(response);
    const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? '';
    if (!bytes || !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(contentType)) return null;
    return { contentType, bytes };
  }
  return null;
}
