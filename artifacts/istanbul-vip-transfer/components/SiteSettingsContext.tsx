'use client';

/**
 * components/SiteSettingsContext.tsx
 *
 * Provides contact settings (phone, WhatsApp, email, …) to all client
 * components in the public layout without prop-drilling.
 *
 * Usage pattern in Next.js App Router:
 *
 *   // Server component (e.g. app/layout.tsx):
 *   const cs = await getContactSettings();
 *   return <SiteSettingsProvider settings={cs}>{children}</SiteSettingsProvider>;
 *
 *   // Any client component in the tree:
 *   const cs = useSiteSettings();
 *   <a href={cs.phoneTel}>{cs.phoneDisplay}</a>
 *
 * The provider is initialised with server-fetched values, so there is no
 * client-side fetch and no hydration mismatch.
 */

import { createContext, useContext } from 'react';
import type { ContactSettings } from '@/lib/site-settings-server';
import { SITE } from '@/lib/site-config';

// ── Default value (static fallback for type safety) ──────────────────────────

const DEFAULT_SETTINGS: ContactSettings = {
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
  googleReviewUrl:  SITE.googleReviewUrl,
  tiktokUrl:        '',
  youtubeUrl:       '',
};

// ── Context ───────────────────────────────────────────────────────────────────

const SiteSettingsCtx = createContext<ContactSettings>(DEFAULT_SETTINGS);

// ── Provider (used in server layout) ─────────────────────────────────────────

export function SiteSettingsProvider({
  settings,
  children,
}: {
  settings: ContactSettings;
  children: React.ReactNode;
}) {
  return (
    <SiteSettingsCtx.Provider value={settings}>
      {children}
    </SiteSettingsCtx.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/** Returns the current site contact settings from the nearest provider. */
export function useSiteSettings(): ContactSettings {
  return useContext(SiteSettingsCtx);
}
