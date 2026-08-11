/**
 * Structured type definitions for service page CMS content.
 * These types define the JSONB shape stored in content.body and
 * content_translations.body for service page records (contentType='SERVICE').
 *
 * NOTE: This module is intentionally NOT marked `server-only` — it contains
 * pure type definitions and JSON parsing used both in server-side health checks
 * and in Playwright tests. Server-only boundaries are enforced by the modules
 * that import DB/SMTP utilities, not here.
 */

export interface ServicePageHero {
  badge: string;
  title: string;
  subtitle: string;
  crumb: string;
  ctaPrimary: string;
  ctaSecondary: string;
}

export interface ServicePageSeo {
  ogTitle: string;
  ogDescription: string;
}

export interface ServicePageBody {
  version: 1;
  hero: ServicePageHero;
  features: string[];
  seo: ServicePageSeo;
}

/** Type guard */
export function isServicePageBody(v: unknown): v is ServicePageBody {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as ServicePageBody).version === 1 &&
    typeof (v as ServicePageBody).hero === 'object' &&
    Array.isArray((v as ServicePageBody).features)
  );
}

/** Safely parse JSON body string → ServicePageBody | null */
export function parseServicePageBody(body: string | null | undefined): ServicePageBody | null {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body);
    return isServicePageBody(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Fields that are translatable (sent to AI). */
export function extractTranslatableFields(b: ServicePageBody): Record<string, string> {
  const out: Record<string, string> = {};
  out['hero.badge']        = b.hero.badge;
  out['hero.title']        = b.hero.title;
  out['hero.subtitle']     = b.hero.subtitle;
  out['hero.crumb']        = b.hero.crumb;
  out['hero.ctaPrimary']   = b.hero.ctaPrimary;
  out['hero.ctaSecondary'] = b.hero.ctaSecondary;
  out['seo.ogTitle']       = b.seo.ogTitle;
  out['seo.ogDescription'] = b.seo.ogDescription;
  b.features.forEach((f, i) => { out[`feature.${i}`] = f; });
  return out;
}

/** Apply translated flat fields back into a ServicePageBody. */
export function applyTranslatedFields(
  base: ServicePageBody,
  translated: Record<string, string>,
): ServicePageBody {
  const t: ServicePageBody = JSON.parse(JSON.stringify(base));
  for (const [key, value] of Object.entries(translated)) {
    if (!value) continue;
    if (key === 'hero.badge')        t.hero.badge        = value;
    else if (key === 'hero.title')   t.hero.title        = value;
    else if (key === 'hero.subtitle') t.hero.subtitle    = value;
    else if (key === 'hero.crumb')   t.hero.crumb        = value;
    else if (key === 'hero.ctaPrimary')   t.hero.ctaPrimary  = value;
    else if (key === 'hero.ctaSecondary') t.hero.ctaSecondary = value;
    else if (key === 'seo.ogTitle')       t.seo.ogTitle       = value;
    else if (key === 'seo.ogDescription') t.seo.ogDescription = value;
    else if (key.startsWith('feature.')) {
      const idx = parseInt(key.slice(8), 10);
      if (!isNaN(idx) && idx < t.features.length) t.features[idx] = value;
    }
  }
  return t;
}

/** Stable SHA-256 hash of all translatable fields. */
export function computeTranslatableHash(b: ServicePageBody): string {
  // eval('require') bypasses webpack's static import analysis so this file
  // can be included in server bundles (instrumentation, scheduler) without
  // triggering "can't resolve 'crypto'" warnings in the fallback bundle.
  // At runtime, this always runs in Node.js where `crypto` is available.
  // eslint-disable-next-line no-eval, @typescript-eslint/no-unsafe-assignment
  const { createHash } = eval('require')('crypto') as typeof import('crypto');
  const fields = extractTranslatableFields(b);
  const sorted = Object.fromEntries(Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)));
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

// ── Full record shape returned by the admin API ──────────────────────────────

export interface ServicePageRecord {
  /** content.id */
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  heroImage: string | null;
  heroImageAlt: string | null;
  ogImage: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  indexable: boolean;
  isActive: boolean;
  displayOrder: number;
  status: string;
  publishedAt: string | null;
  updatedAt: string;
  body: ServicePageBody | null;
  translations: ServicePageTranslation[];
}

export interface ServicePageTranslation {
  id: string | null;
  locale: string;
  status: string;
  title: string | null;
  excerpt: string | null;
  body: ServicePageBody | null;
  metaTitle: string | null;
  metaDescription: string | null;
  imageAlt: string | null;
  sourceHash: string | null;
  isManuallyLocked: boolean;
  isAiGenerated: boolean;
  publishedAt: string | null;
  failureReason: string | null;
  updatedAt: string | null;
}
