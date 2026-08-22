/**
 * Verified business contact details for VIP Transfer Istanbul.
 * All phone, WhatsApp, email and profile links are set here.
 * Import from this file everywhere — never hard-code contact info elsewhere.
 */
export const SITE = {
  /** Human-readable display number shown on-screen */
  phoneDisplay: '+90 532 660 08 47',
  /** tel: URI for <a href> */
  phoneTel: 'tel:+905326600847',
  /** Bare E.164 number for schema.org telephone field */
  phoneE164: '+905326600847',

  /** wa.me number (no + or spaces) */
  whatsappNumber: '905326600847',
  /** Base WhatsApp chat URL */
  whatsappUrl: 'https://wa.me/905326600847',
  /** Pre-filled WhatsApp inquiry URL (URL-encoded message preserved) */
  whatsappFloatUrl:
    'https://wa.me/905326600847?text=Merhaba%2C%20VIP%20transfer%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum.',

  /** Public email address */
  email: 'info@istanbulviptransfer.com',
  /** mailto: URI for <a href> */
  emailMailto: 'mailto:info@istanbulviptransfer.com',

  /** Verified Google Business Profile URL. */
  googleBusinessUrl: 'https://share.google/umKdtDsepQm1JxfOy',
  /** Verified Google review URL — this profile link opens the review destination. */
  googleReviewUrl: 'https://share.google/umKdtDsepQm1JxfOy',

  /** Canonical base URL */
  siteUrl: 'https://www.istanbulviptransfer.com',

  /** Default og:image used in social/AI previews (1200×630 px — canonical social card) */
  ogImage: {
    url: 'https://www.istanbulviptransfer.com/images/og-card.jpg',
    width: 1200,
    height: 630,
    alt: 'İstanbul VIP Transfer — Lüks Havalimanı Transferi',
  },
} as const;

/** Returns a pre-filled WhatsApp URL for the booking form submission. */
export function bookingWhatsAppUrl(encodedMessage: string) {
  return `${SITE.whatsappUrl}?text=${encodedMessage}`;
}
