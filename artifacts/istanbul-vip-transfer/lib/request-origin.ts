import 'server-only';

import type { NextRequest } from 'next/server';

/**
 * Returns a bounded, same-origin page pathname suitable for operational
 * reporting. Query strings, fragments and arbitrary user text are discarded.
 */
export function getRequestPageSlug(request: NextRequest, fallback: string): string {
  const referer = request.headers.get('referer');
  if (!referer) return fallback;

  try {
    const url = new URL(referer);
    if (url.origin !== request.nextUrl.origin) return fallback;
    const pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
    return /^\/[a-zA-Z0-9/_-]{0,180}$/.test(pathname) ? pathname : fallback;
  } catch {
    return fallback;
  }
}