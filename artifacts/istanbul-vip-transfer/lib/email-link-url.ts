import 'server-only';

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { siteSettings } from '@/db/schema';

export type EmailLinkOriginStatus =
  | { mode: 'setting'; baseUrl: string; isPreviewDomain: boolean }
  | { mode: 'proxy-fallback'; baseUrl: string; isPreviewDomain: boolean }
  | { mode: 'unavailable'; baseUrl: null; isPreviewDomain: false };

function isUnsafeHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost'
    || host === '0.0.0.0'
    || host === '::1'
    || /^127(?:\.\d{1,3}){3}$/.test(host);
}

/**
 * True for Replit's own temporary development/preview hostnames — never a
 * real production domain. `.replit.app` is excluded on purpose: that suffix
 * is used by *published* Replit deployments, which are a legitimate public
 * production address.
 *
 * A configured `public_site_url` pointing at one of these hosts means
 * transactional email links will work today (while testing in the
 * workspace) but will silently keep pointing at a temporary address that
 * disappears — this must surface as a loud warning, never fail silently.
 */
export function isPreviewHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host.endsWith('.replit.dev') || host.endsWith('.repl.co');
}

function normalizePublicHost(rawHost: string | null | undefined): string | null {
  const first = rawHost?.split(',')[0]?.trim().toLowerCase() ?? '';
  if (!first || /[\s/@\\]/.test(first)) return null;

  let hostname: string;
  try {
    hostname = new URL(`https://${first}`).hostname.toLowerCase();
  } catch {
    return null;
  }

  if (!hostname || isUnsafeHost(hostname)) return null;
  return hostname;
}

/**
 * Produces the only base URL that is allowed in transactional emails.
 * Ports, container addresses, `Host`, and request URLs are deliberately never
 * used. A reverse proxy may provide x-forwarded-host when no explicit setting
 * exists; all output is HTTPS and has no port.
 */
export function normalizeEmailLinkBaseUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    const host = normalizePublicHost(parsed.host);
    if (!host) return null;
    return `https://${host}`;
  } catch {
    return null;
  }
}

export async function resolveEmailLinkOrigin(request?: Request): Promise<EmailLinkOriginStatus> {
  try {
    const [settings] = await db.select({ publicSiteUrl: siteSettings.publicSiteUrl })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1);
    const configured = normalizeEmailLinkBaseUrl(settings?.publicSiteUrl);
    if (configured) {
      return { mode: 'setting', baseUrl: configured, isPreviewDomain: isPreviewHost(new URL(configured).hostname) };
    }
  } catch {
    // A failed settings read must never cause a container URL to leak.
  }

  const forwardedHost = request?.headers.get('x-forwarded-host');
  const host = normalizePublicHost(forwardedHost);
  if (host) return { mode: 'proxy-fallback', baseUrl: `https://${host}`, isPreviewDomain: isPreviewHost(host) };

  return { mode: 'unavailable', baseUrl: null, isPreviewDomain: false };
}

export function buildEmailLink(
  baseUrl: string | null,
  pathname: string,
  parameters: Record<string, string>,
): string | null {
  if (!baseUrl) return null;
  const url = new URL(pathname, baseUrl);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return url.toString();
}