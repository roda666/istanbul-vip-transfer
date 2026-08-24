import { isIP } from 'node:net';
import { NextRequest } from 'next/server';

function normalizeIp(value: string | null): string | null {
  const candidate = value?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}

/**
 * Resolve the address supplied by the hosting reverse proxy.
 *
 * The proxy's rightmost X-Forwarded-For entry is the address it appended for
 * this request. Earlier entries are client-controlled and must not be used for
 * abuse-prevention identity.
 */
export function getTrustedClientIp(req: NextRequest): string | null {
  const platformIp = normalizeIp(req.headers.get('x-real-ip'));
  if (platformIp) return platformIp;

  const forwarded = req.headers.get('x-forwarded-for');
  if (!forwarded) return null;

  const entries = forwarded
    .split(',')
    .map((entry) => normalizeIp(entry))
    .filter((entry): entry is string => Boolean(entry));

  return entries.at(-1) ?? null;
}