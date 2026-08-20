import type { NextRequest } from 'next/server';

export const SOCIAL_SETTINGS_PATH = '/admin/ayarlar/icerik-entegrasyonlari';

export const SOCIAL_CALLBACK_PATHS = {
  meta: '/admin/api/social-platforms/meta/callback',
  x: '/admin/api/social-platforms/x/callback',
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

function getPublicHost(req: Request) {
  const forwardedHost = normalizeHost(firstHeaderValue(req.headers.get('x-forwarded-host')));
  if (forwardedHost) return forwardedHost;

  const requestHost = normalizeHost(firstHeaderValue(req.headers.get('host')));
  if (requestHost) return requestHost;

  const configuredHost = normalizeHost(firstHeaderValue(process.env.REPLIT_DEV_DOMAIN ?? null))
    ?? normalizeHost(firstHeaderValue(process.env.REPLIT_DOMAINS ?? null));
  if (configuredHost) return configuredHost;

  throw new Error('Public OAuth host belirlenemedi.');
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