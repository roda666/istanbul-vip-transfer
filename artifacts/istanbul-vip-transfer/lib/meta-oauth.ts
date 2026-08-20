import { NextRequest } from 'next/server';

export const META_CALLBACK_PATH = '/admin/api/social-platforms/meta/callback';

function getForwardedHost(req: NextRequest) {
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || req.headers.get('host')?.trim();
  if (host) return host.replace(/:443$/, '');

  return new URL(req.url).host.replace(/:443$/, '');
}

export function getMetaCallbackUri(req: NextRequest) {
  return `https://${getForwardedHost(req)}${META_CALLBACK_PATH}`;
}