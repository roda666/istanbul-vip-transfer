/**
 * Structured type definitions for service page CMS content.
 * These types define the JSONB shape stored in content.body and
 * content_translations.body for service page records (contentType='SERVICE').
 *
 * NOTE: This module is intentionally NOT marked `server-only` — it contains
 * pure type definitions and JSON parsing used both in server-side health checks
 * and in Playwright tests. Server-only boundaries are enforced by the modules
 * that import DB/SMTP utilities, not here.
 *
 * VERSIONING:
 *   v1 — hero, features[], seo  (original)
 *   v2 — + introBody?, contentSections[]?, serviceArea?, faqs[]  (backward-compat superset)
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

/** A rich content block (H2 or H3 heading + paragraph body). */
export interface ServicePageContentSection {
  /** Stable client-side key (nanoid/uuid) — never translated, never shown publicly. */
  id: string;
  headingLevel: 'h2' | 'h3';
  heading: string;
  body: string;
}

/** Geographic / operational area information for the service. */
export interface ServicePageServiceArea {
  title: string;
  description: string;
  /** List of individual area names (cities, districts, airports…). */
  areas: string[];
}

/** A single FAQ item. */
export interface ServicePageFaq {
  /** Stable client-side key — never translated. */
  id: string;
  question: string;
  answer: string;
}

export interface ServicePageBody {
  version: 1 | 2;
  hero: ServicePageHero;
  features: string[];
  seo: ServicePageSeo;
  // ── v2 additions (optional — omitted in v1 records) ──────────────────────
  /** Introductory paragraph displayed beneath the hero. */
  introBody?: string;
  /** Ordered list of H2/H3 content sections. */
  contentSections?: ServicePageContentSection[];
  /** Service area coverage block. */
  serviceArea?: ServicePageServiceArea;
  /** FAQ items rendered with FAQPage JSON-LD. */
  faqs?: ServicePageFaq[];
}

// ── Type guard ────────────────────────────────────────────────────────────────

/** Accepts both v1 and v2 bodies. */
export function isServicePageBody(v: unknown): v is ServicePageBody {
  return (
    typeof v === 'object' &&
    v !== null &&
    ((v as ServicePageBody).version === 1 || (v as ServicePageBody).version === 2) &&
    typeof (v as ServicePageBody).hero === 'object' &&
    (v as ServicePageBody).hero !== null &&
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

// ── Translatable field extraction ─────────────────────────────────────────────

/**
 * Returns a flat key→value map of all translatable text in a ServicePageBody.
 * Keys are stable identifiers used by applyTranslatedFields() to reconstruct
 * the translated body. New v2 fields use separate key namespaces that never
 * collide with existing v1 keys.
 */
export function extractTranslatableFields(b: ServicePageBody): Record<string, string> {
  const out: Record<string, string> = {};

  // ── v1 fields ──────────────────────────────────────────────────────────────
  out['hero.badge']        = b.hero.badge;
  out['hero.title']        = b.hero.title;
  out['hero.subtitle']     = b.hero.subtitle;
  out['hero.crumb']        = b.hero.crumb;
  out['hero.ctaPrimary']   = b.hero.ctaPrimary;
  out['hero.ctaSecondary'] = b.hero.ctaSecondary;
  out['seo.ogTitle']       = b.seo.ogTitle;
  out['seo.ogDescription'] = b.seo.ogDescription;
  b.features.forEach((f, i) => { out[`feature.${i}`] = f; });

  // ── v2 fields ──────────────────────────────────────────────────────────────
  if (b.introBody) {
    out['introBody'] = b.introBody;
  }
  if (b.contentSections) {
    b.contentSections.forEach((s, i) => {
      out[`contentSection.${i}.heading`] = s.heading;
      out[`contentSection.${i}.body`]    = s.body;
    });
  }
  if (b.serviceArea) {
    out['serviceArea.title']       = b.serviceArea.title;
    out['serviceArea.description'] = b.serviceArea.description;
    b.serviceArea.areas.forEach((a, i) => { out[`serviceArea.area.${i}`] = a; });
  }
  if (b.faqs) {
    b.faqs.forEach((f, i) => {
      out[`faq.${i}.question`] = f.question;
      out[`faq.${i}.answer`]   = f.answer;
    });
  }

  return out;
}

/** Apply translated flat fields back into a ServicePageBody (deep clone). */
export function applyTranslatedFields(
  base: ServicePageBody,
  translated: Record<string, string>,
): ServicePageBody {
  const t: ServicePageBody = JSON.parse(JSON.stringify(base));

  for (const [key, value] of Object.entries(translated)) {
    if (!value) continue;

    // ── v1 fields ────────────────────────────────────────────────────────────
    if      (key === 'hero.badge')        t.hero.badge          = value;
    else if (key === 'hero.title')        t.hero.title          = value;
    else if (key === 'hero.subtitle')     t.hero.subtitle       = value;
    else if (key === 'hero.crumb')        t.hero.crumb          = value;
    else if (key === 'hero.ctaPrimary')   t.hero.ctaPrimary     = value;
    else if (key === 'hero.ctaSecondary') t.hero.ctaSecondary   = value;
    else if (key === 'seo.ogTitle')       t.seo.ogTitle         = value;
    else if (key === 'seo.ogDescription') t.seo.ogDescription   = value;
    else if (key.startsWith('feature.')) {
      const idx = parseInt(key.slice(8), 10);
      if (!isNaN(idx) && idx < t.features.length) t.features[idx] = value;
    }

    // ── v2 fields ────────────────────────────────────────────────────────────
    else if (key === 'introBody') {
      t.introBody = value;
    }
    else if (key.startsWith('contentSection.')) {
      // contentSection.{i}.heading  or  contentSection.{i}.body
      const parts = key.split('.');
      if (parts.length === 3 && t.contentSections) {
        const idx   = parseInt(parts[1], 10);
        const field = parts[2] as 'heading' | 'body';
        if (!isNaN(idx) && idx < t.contentSections.length && (field === 'heading' || field === 'body')) {
          t.contentSections[idx][field] = value;
        }
      }
    }
    else if (key === 'serviceArea.title' && t.serviceArea) {
      t.serviceArea.title = value;
    }
    else if (key === 'serviceArea.description' && t.serviceArea) {
      t.serviceArea.description = value;
    }
    else if (key.startsWith('serviceArea.area.') && t.serviceArea) {
      const idx = parseInt(key.slice('serviceArea.area.'.length), 10);
      if (!isNaN(idx) && idx < t.serviceArea.areas.length) {
        t.serviceArea.areas[idx] = value;
      }
    }
    else if (key.startsWith('faq.') && t.faqs) {
      // faq.{i}.question  or  faq.{i}.answer
      const parts = key.split('.');
      if (parts.length === 3) {
        const idx   = parseInt(parts[1], 10);
        const field = parts[2] as 'question' | 'answer';
        if (!isNaN(idx) && idx < t.faqs.length && (field === 'question' || field === 'answer')) {
          t.faqs[idx][field] = value;
        }
      }
    }
  }

  return t;
}

/** Stable SHA-256 hash of all translatable fields (for change detection). */
export function computeTranslatableHash(b: ServicePageBody): string {
  // eval('require') bypasses webpack's static import analysis so this file
  // can be included in server bundles (instrumentation, scheduler) without
  // triggering "can't resolve 'crypto'" warnings in the fallback bundle.
  // At runtime, this always runs in Node.js where `crypto` is available.
  const { createHash } = eval('require')('crypto') as typeof import('crypto');
  const fields = extractTranslatableFields(b);
  const sorted = Object.fromEntries(Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)));
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

// ── Full record shapes ────────────────────────────────────────────────────────

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
  category: string | null;
  showOnHomepage: boolean;
  showInNav: boolean;
  status: string;
  publishedAt: string | null;
  updatedAt: string;
  body: ServicePageBody | null;
  /**
   * Pending draft body for PUBLISHED pages.
   * Non-null when the admin has saved changes without publishing.
   * The editor should initialise from this when present; the live page
   * continues to use `body` until the admin clicks "Kaydet ve Yayımla".
   */
  draftBody: ServicePageBody | null;
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
