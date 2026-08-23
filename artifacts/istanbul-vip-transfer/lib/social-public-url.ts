import type { NextRequest } from 'next/server';
import { SITE } from '@/lib/site-config';

export const SOCIAL_SETTINGS_PATH = '/admin/ayarlar/icerik-entegrasyonlari';

export const SOCIAL_CALLBACK_PATHS = {
  meta: '/admin/api/social-platforms/meta/callback',
  x: '/admin/api/social-platforms/x/callback',
  google_business: '/admin/api/social-platforms/google-business/callback',
} as const;

const INTERNAL_HOST = /^(?:0\.0\.0\.0|localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)(?::\d+)?$/i;

function firstHeaderValue(value: string | null) {
  return value?.split(',')[0]?.trim() || null;
}

function normalizeHost(value: string | null) {
  if (!value) return null;
  const host = value.replace(/:443$/, '');
  return INTERNAL_HOST.test(host) ? null : host;
}

function configuredPublicHosts() {
  const hosts = new Set<string>();
  try {
    hosts.add(new URL(SITE.siteUrl).host);
  } catch {
    // SITE.siteUrl is a code-owned constant. Keep the safe fallback below.
  }
  for (const value of [process.env.REPLIT_DOMAINS, process.env.REPLIT_DEV_DOMAIN]) {
    for (const host of value?.split(',') ?? []) {
      const normalized = normalizeHost(host.trim());
      if (normalized) hosts.add(normalized);
    }
  }
  return hosts;
}

function getPublicHost(req: Request) {
  const allowedHosts = configuredPublicHosts();
  const forwardedHost = normalizeHost(firstHeaderValue(req.headers.get('x-forwarded-host')));
  if (forwardedHost && allowedHosts.has(forwardedHost)) return forwardedHost;

  const requestHost = normalizeHost(firstHeaderValue(req.headers.get('host')));
  if (requestHost && allowedHosts.has(requestHost)) return requestHost;

  const canonicalHost = normalizeHost(new URL(SITE.siteUrl).host);
  if (canonicalHost) return canonicalHost;

  throw new Error('Güvenilir public OAuth host belirlenemedi.');
}

export function getPublicOrigin(req: Request) {
  return `https://${getPublicHost(req)}`;
}

export function getPublicUrl(req: Request, path: string) {
  return new URL(path, getPublicOrigin(req)).toString();
}

export function getSocialSettingsUrl(req: Request, params?: Record<string, string>) {
  const url = new URL(SOCIAL_SETTINGS_PATH, getPublicOrigin(req));
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function getSocialCallbackUrl(
  req: NextRequest,
  provider: keyof typeof SOCIAL_CALLBACK_PATHS,
) {
  return getPublicUrl(req, SOCIAL_CALLBACK_PATHS[provider]);
}