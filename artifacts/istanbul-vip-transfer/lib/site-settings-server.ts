/**
 * lib/site-settings-server.ts  —  SERVER-ONLY
 *
 * Reads contact fields from the `site_settings` DB table and returns a fully
 * derived ContactSettings object.  Falls back to the static SITE constants
 * (lib/site-config.ts) when the DB row is absent or unreachable.
 *
 * Module-level cache with a 5-minute TTL so the DB is not hit on every
 * request while still picking up admin changes within minutes.
 *
 * Call `invalidateContactSettings()` from the admin settings POST handler so
 * the next request reflects the updated values immediately.
 */
import 'server-only';

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { siteSettings } from '@/db/schema';
import { SITE } from './site-config';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ContactSettings = {
  /** '+90 532 660 08 47' */
  phoneDisplay: string;
  /** 'tel:+905326600847' */
  phoneTel: string;
  /** '+905326600847'  (bare E.164, used in schema.org) */
  phoneE164: string;
  /** '905326600847'  (no + or spaces, for wa.me URLs) */
  whatsappNumber: string;
  /** 'https://wa.me/905326600847' */
  whatsappUrl: string;
  /** Pre-filled WhatsApp inquiry URL */
  whatsappFloatUrl: string;
  /** 'info@istanbulviptransfer.com' */
  email: string;
  /** 'mailto:info@istanbulviptransfer.com' */
  emailMailto: string;
  /** Google Business profile URL */
  googleBusinessUrl: string;
  // Legal / trust fields (shown in footer and legal pages)
  /** Registered company legal name, e.g. "Hevra Turizm" */
  companyLegalName: string;
  /** Trade/brand name, e.g. "The History Travel" */
  companyTradeName: string;
  /** TÜRSAB license number, e.g. "A-7377" */
  tursabNo: string;
  /** Full registered address */
  fullAddress: string;
  /** Google Play app URL (optional, empty string if not set) */
  googlePlayUrl: string;
};

// ── Fallback (static SITE values) ─────────────────────────────────────────────

const STATIC_DEFAULTS: ContactSettings = {
  phoneDisplay:     SITE.phoneDisplay,
  phoneTel:         SITE.phoneTel,
  phoneE164:        SITE.phoneE164,
  whatsappNumber:   SITE.whatsappNumber,
  whatsappUrl:      SITE.whatsappUrl,
  whatsappFloatUrl: SITE.whatsappFloatUrl,
  email:            SITE.email,
  emailMailto:      SITE.emailMailto,
  googleBusinessUrl: SITE.googleBusinessUrl,
  companyLegalName: '',
  companyTradeName: '',
  tursabNo:         '',
  fullAddress:      '',
  googlePlayUrl:    '',
};

// ── Module-level cache ─────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1_000; // 5 minutes

let _cached:   ContactSettings | null = null;
let _cachedAt: number = 0;

/** Clear the module-level cache so the next call re-reads from the DB. */
export function invalidateContactSettings(): void {
  _cached   = null;
  _cachedAt = 0;
}

// ── Builder ───────────────────────────────────────────────────────────────────

function buildFromRow(row: typeof siteSettings.$inferSelect): ContactSettings {
  const phone     = (row.phoneInternational ?? '').trim() || SITE.phoneE164;
  const display   = (row.phoneDisplay      ?? '').trim() || SITE.phoneDisplay;
  const whatsapp  = (row.whatsappNumber    ?? '').trim() || SITE.whatsappNumber;
  const email     = (row.email             ?? '').trim() || SITE.email;
  const gbUrl     = (row.googleBusinessUrl ?? '').trim() || SITE.googleBusinessUrl;

  // Normalise phone to E.164 (strip leading + if already present for wa.me)
  const waNum = whatsapp.replace(/^\+/, '');

  return {
    phoneDisplay:     display,
    phoneTel:         `tel:${phone}`,
    phoneE164:        phone,
    whatsappNumber:   waNum,
    whatsappUrl:      `https://wa.me/${waNum}`,
    whatsappFloatUrl: `https://wa.me/${waNum}?text=Merhaba%2C%20VIP%20transfer%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum.`,
    email,
    emailMailto:      `mailto:${email}`,
    googleBusinessUrl: gbUrl,
    companyLegalName: (row.companyLegalName ?? '').trim(),
    companyTradeName: (row.companyTradeName ?? '').trim(),
    tursabNo:         (row.tursabNo         ?? '').trim(),
    fullAddress:      (row.fullAddress       ?? '').trim(),
    googlePlayUrl:    (row.googlePlayUrl     ?? '').trim(),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns contact settings from the DB (cached).
 * Falls back to the static SITE config if the DB has no row or is unreachable.
 */
export async function getContactSettings(): Promise<ContactSettings> {
  if (_cached && Date.now() - _cachedAt < CACHE_TTL_MS) {
    return _cached;
  }

  try {
    const rows = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1);

    if (rows.length === 0) {
      // DB row not yet seeded — return static defaults without caching so
      // the next request tries again (e.g. after admin saves for the first time).
      return STATIC_DEFAULTS;
    }

    _cached   = buildFromRow(rows[0]);
    _cachedAt = Date.now();
    return _cached;
  } catch {
    // DB unreachable — return static defaults; do not cache so recovery is fast.
    return STATIC_DEFAULTS;
  }
}
