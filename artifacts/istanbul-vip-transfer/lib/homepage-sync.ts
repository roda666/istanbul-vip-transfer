/**
 * Homepage translation sync utilities.
 *
 * Classifies section fields into:
 *  - SHARED: image/file refs, URLs, enabled flags, identifiers, numeric values
 *            → copied verbatim to all target locales, no AI needed
 *  - TRANSLATABLE: all human-readable text
 *            → hashed and sent to AI only when the hash changes
 *
 * Server-only — never import from client components.
 */
import 'server-only';
import { createHash } from 'crypto';
import type {
  HomepageSections, HeroSection, ServicesSectionData,
  TrustSectionData, VehiclesSectionData, ReviewsSectionData,
  ReservationSectionData, ContactSectionData, FooterSectionData,
  HomepageSeoData, TrustCard,
} from './homepage-types';

// ── Translatable field extraction ───────────────────────────────────────────

/**
 * Returns a flat map of `"section.field"` → string for every translatable text
 * field in a HomepageSections object. Array items are keyed by their stable id
 * or key (e.g. `heroStat.airport.label`, `trustCard.meet.title`).
 */
export function extractTranslatableFields(s: HomepageSections): Record<string, string> {
  const out: Record<string, string> = {};

  // A – Hero
  const h = s.hero;
  out['hero.badge']          = h.badge;
  out['hero.headline1']      = h.headline1;
  out['hero.headlineAccent'] = h.headlineAccent;
  out['hero.headline2']      = h.headline2;
  out['hero.subheadline']    = h.subheadline;
  out['hero.ctaBookingText'] = h.ctaBookingText;
  out['hero.ctaCallText']    = h.ctaCallText;
  out['hero.imageAlt']       = h.imageAlt;

  // B – Stats (label only; numberText is LTR-preserved shared field)
  for (const stat of s.heroStats) {
    out[`heroStat.${stat.key}.label`] = stat.label;
  }

  // C – Services section
  const sv = s.servicesSection;
  out['services.eyebrow']         = sv.eyebrow;
  out['services.heading']         = sv.heading;
  out['services.description']     = sv.description;
  out['services.allServicesText'] = sv.allServicesText;

  // D – Trust section
  const tr = s.trustSection;
  out['trust.eyebrow'] = tr.eyebrow;
  out['trust.heading'] = tr.heading;
  for (const card of tr.cards) {
    out[`trustCard.${card.id}.title`]       = card.title;
    out[`trustCard.${card.id}.description`] = card.description;
  }

  // E – Vehicles section
  const vh = s.vehiclesSection;
  out['vehicles.heading']     = vh.heading;
  out['vehicles.description'] = vh.description;
  out['vehicles.ctaText']     = vh.ctaText;

  // F – Reviews section
  const rv = s.reviewsSection;
  out['reviews.eyebrow']     = rv.eyebrow;
  out['reviews.heading']     = rv.heading;
  out['reviews.viewAllText'] = rv.viewAllText;

  // G – Reservation
  const rs = s.reservationSection;
  out['reservation.eyebrow']     = rs.eyebrow;
  out['reservation.heading']     = rs.heading;
  out['reservation.description'] = rs.description;

  // H – Contact
  const ct = s.contactSection;
  out['contact.eyebrow']        = ct.eyebrow;
  out['contact.heading']        = ct.heading;
  out['contact.subheading']     = ct.subheading;
  out['contact.whatsappCtaText'] = ct.whatsappCtaText;

  // I – Footer
  const ft = s.footerSection;
  out['footer.tagline']        = ft.tagline;
  out['footer.premiumTagline'] = ft.premiumTagline;
  out['footer.col1Heading']    = ft.col1Heading;
  out['footer.col2Heading']    = ft.col2Heading;
  out['footer.col3Heading']    = ft.col3Heading;
  out['footer.copyrightText']  = ft.copyrightText;

  // J – SEO
  const seo = s.seo;
  out['seo.metaTitle']       = seo.metaTitle;
  out['seo.metaDescription'] = seo.metaDescription;
  out['seo.ogTitle']         = seo.ogTitle;
  out['seo.ogDescription']   = seo.ogDescription;
  out['seo.ogImageAlt']      = seo.ogImageAlt;

  return out;
}

/** SHA-256 of the translatable fields — stable key ordering via JSON.stringify. */
export function computeTranslatableHash(s: HomepageSections): string {
  const fields = extractTranslatableFields(s);
  const sorted = Object.fromEntries(Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)));
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

// ── Shared field sync ───────────────────────────────────────────────────────

/**
 * Returns a copy of `target` with all SHARED (non-translatable) fields
 * replaced by the corresponding values from `source` (Turkish).
 *
 * Shared fields:
 *  - hero:          imagePath, enabled
 *  - heroStats:     numberText, key, order, enabled  (label stays)
 *  - services:      allServicesRoute, enabled
 *  - trust:         cards[i].icon, .id, .order, .enabled;  section.enabled
 *  - vehicles:      ctaRoute, enabled
 *  - reviews:       enabled
 *  - reservation:   enabled
 *  - contact:       enabled
 *  - seo:           ogImage, indexable
 */
export function syncSharedFields(
  target: HomepageSections,
  source: HomepageSections,
): HomepageSections {
  // Deep-clone target so we don't mutate
  const t: HomepageSections = JSON.parse(JSON.stringify(target));
  const s = source;

  // Hero
  t.hero.imagePath = s.hero.imagePath;
  t.hero.enabled   = s.hero.enabled;

  // Stats — match by key
  const sourceStatsByKey = Object.fromEntries(s.heroStats.map(st => [st.key, st]));
  t.heroStats = t.heroStats.map(stat => {
    const src = sourceStatsByKey[stat.key];
    if (!src) return stat;
    return { ...stat, numberText: src.numberText, key: src.key, order: src.order, enabled: src.enabled };
  });
  // Add any new stats from source that don't exist in target
  for (const srcStat of s.heroStats) {
    if (!t.heroStats.find(x => x.key === srcStat.key)) {
      t.heroStats.push(srcStat); // Copy full stat including label (new item — use source text)
    }
  }
  t.heroStats.sort((a, b) => a.order - b.order);

  // Services
  t.servicesSection.allServicesRoute = s.servicesSection.allServicesRoute;
  t.servicesSection.enabled          = s.servicesSection.enabled;

  // Trust cards — match by id
  const srcCardsById = Object.fromEntries(s.trustSection.cards.map(c => [c.id, c]));
  t.trustSection.cards = t.trustSection.cards.map(card => {
    const src = srcCardsById[card.id];
    if (!src) return card;
    return { ...card, icon: src.icon, id: src.id, order: src.order, enabled: src.enabled };
  });
  for (const srcCard of s.trustSection.cards) {
    if (!t.trustSection.cards.find(x => x.id === srcCard.id)) {
      t.trustSection.cards.push(srcCard);
    }
  }
  t.trustSection.cards.sort((a, b) => a.order - b.order);
  t.trustSection.enabled = s.trustSection.enabled;

  // Vehicles
  t.vehiclesSection.ctaRoute = s.vehiclesSection.ctaRoute;
  t.vehiclesSection.enabled  = s.vehiclesSection.enabled;

  // Others
  t.reviewsSection.enabled     = s.reviewsSection.enabled;
  t.reservationSection.enabled = s.reservationSection.enabled;
  t.contactSection.enabled     = s.contactSection.enabled;

  // SEO
  t.seo.ogImage    = s.seo.ogImage;
  t.seo.indexable  = s.seo.indexable;

  return t;
}

// ── Apply translated fields back to sections ─────────────────────────────────

/**
 * Merges translated flat fields back into a HomepageSections object.
 * Unknown keys are silently ignored.
 */
export function applyTranslatedFields(
  base: HomepageSections,
  translated: Record<string, string>,
): HomepageSections {
  const t: HomepageSections = JSON.parse(JSON.stringify(base));

  for (const [key, value] of Object.entries(translated)) {
    if (!value) continue;

    if (key.startsWith('hero.')) {
      const field = key.slice(5) as keyof HeroSection;
      if (typeof t.hero[field] === 'string') (t.hero as unknown as Record<string, unknown>)[field] = value;
    } else if (key.startsWith('heroStat.')) {
      const parts = key.split('.');
      const statKey = parts[1];
      const fieldName = parts[2];
      const stat = t.heroStats.find(s => s.key === statKey);
      if (stat && fieldName === 'label') stat.label = value;
    } else if (key.startsWith('services.')) {
      const field = key.slice(9) as keyof ServicesSectionData;
      if (typeof t.servicesSection[field] === 'string') (t.servicesSection as unknown as Record<string, unknown>)[field] = value;
    } else if (key.startsWith('trust.')) {
      const field = key.slice(6) as keyof TrustSectionData;
      if (typeof t.trustSection[field] === 'string') (t.trustSection as unknown as Record<string, unknown>)[field] = value;
    } else if (key.startsWith('trustCard.')) {
      const parts = key.split('.');
      const cardId = parts[1];
      const fieldName = parts[2] as keyof TrustCard;
      const card = t.trustSection.cards.find(c => c.id === cardId);
      if (card && typeof card[fieldName] === 'string') (card as unknown as Record<string, unknown>)[fieldName] = value;
    } else if (key.startsWith('vehicles.')) {
      const field = key.slice(9) as keyof VehiclesSectionData;
      if (typeof t.vehiclesSection[field] === 'string') (t.vehiclesSection as unknown as Record<string, unknown>)[field] = value;
    } else if (key.startsWith('reviews.')) {
      const field = key.slice(8) as keyof ReviewsSectionData;
      if (typeof t.reviewsSection[field] === 'string') (t.reviewsSection as unknown as Record<string, unknown>)[field] = value;
    } else if (key.startsWith('reservation.')) {
      const field = key.slice(12) as keyof ReservationSectionData;
      if (typeof t.reservationSection[field] === 'string') (t.reservationSection as unknown as Record<string, unknown>)[field] = value;
    } else if (key.startsWith('contact.')) {
      const field = key.slice(8) as keyof ContactSectionData;
      if (typeof t.contactSection[field] === 'string') (t.contactSection as unknown as Record<string, unknown>)[field] = value;
    } else if (key.startsWith('footer.')) {
      const field = key.slice(7) as keyof FooterSectionData;
      if (typeof t.footerSection[field] === 'string') (t.footerSection as unknown as Record<string, unknown>)[field] = value;
    } else if (key.startsWith('seo.')) {
      const field = key.slice(4) as keyof HomepageSeoData;
      if (typeof t.seo[field] === 'string') (t.seo as unknown as Record<string, unknown>)[field] = value;
    }
  }

  return t;
}

// ── Helper: build a fully-shared-synced sections from TR fallback ──────────

/**
 * Given a TR source and an existing (possibly outdated) target,
 * returns a new target with:
 *  1. Shared fields replaced from source
 *  2. Structure normalized (no orphan stats/cards)
 *
 * Used when a target locale has no body yet (first-time sync).
 */
export function buildInitialTargetSections(
  source: HomepageSections,
  fallback: HomepageSections,
): HomepageSections {
  // Start from the locale fallback (pre-translated static text)
  // then sync shared fields from the live source
  return syncSharedFields(fallback, source);
}
