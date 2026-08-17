import type { Metadata, Viewport } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import './globals.css';
import PublicLayoutWrapper from '@/components/PublicLayoutWrapper';
import WebVitalsReporter from '@/components/WebVitalsReporter';
import { SITE } from '@/lib/site-config';
import { getServiceVisibilityMap } from '@/lib/service-page-cms';
import { getContactSettings } from '@/lib/site-settings-server';
import { SiteSettingsProvider } from '@/components/SiteSettingsContext';

/**
 * Self-hosted via next/font — eliminates the external Google Fonts request
 * and associated layout shift / FOIT. CSS variable names map to the existing
 * --app-font-serif / --app-font-sans variables in globals.css.
 */
const playfairDisplay = Playfair_Display({
  subsets:  ['latin'],
  variable: '--font-playfair',
  display:  'swap',
  weight:   ['400', '500', '600', '700', '800', '900'],
  style:    ['normal', 'italic'],
});

const inter = Inter({
  subsets:  ['latin'],
  variable: '--font-inter',
  display:  'swap',
  weight:   ['300', '400', '500', '600', '700'],
});

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  viewportFit:  'cover',   // expose safe-area-inset-* CSS env vars
  themeColor:   '#102A43',
};

export const metadata: Metadata = {
  // Plain string fallback — all public pages set their own complete title.
  title: 'İstanbul VIP Transfer | Vito ve Sprinter Hizmeti',
  description:
    'İstanbul VIP transfer hizmeti; İstanbul Havalimanı, Sabiha Gökçen, şehir içi ve şehirler arası Mercedes Vito ve Sprinter ulaşımı.',
  metadataBase: new URL(SITE.siteUrl),
  openGraph: {
    images: [SITE.ogImage],
  },
};

// Force-dynamic ensures the root layout re-runs on every request so that
// showInNav visibility changes take effect in Header/Footer immediately.
export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Fetch nav visibility server-side so Header can filter showInNav=false items.
  // Gracefully falls back to an empty array (all nav items shown) if DB is unavailable.
  const [visibilityMap, contactSettings] = await Promise.all([
    getServiceVisibilityMap().catch(() => new Map<string, { showOnHomepage: boolean; showInNav: boolean }>()),
    getContactSettings(),
  ]);
  const hiddenNavSlugs = [...visibilityMap.entries()]
    .filter(([, flags]) => !flags.showInNav)
    .map(([slug]) => slug);

  return (
    /*
     * suppressHydrationWarning is required because [lang]/layout.tsx
     * injects a synchronous <script> that updates html[lang] and html[dir]
     * for non-Turkish pages before React hydration. Without this attribute
     * React would warn about the attribute mismatch.
     */
    <html lang="tr" dir="ltr" suppressHydrationWarning className={`${playfairDisplay.variable} ${inter.variable}`}>
      <body
        className="grain-overlay"
        style={{ backgroundColor: 'var(--pub-page-bg, #F7F5EF)', minHeight: '100dvh' }}
      >
        {/* PublicLayoutWrapper conditionally adds Header/Footer for public routes.
            Admin routes render their own layout without public chrome. */}
        <SiteSettingsProvider settings={contactSettings}>
          <PublicLayoutWrapper hiddenNavSlugs={hiddenNavSlugs}>{children}</PublicLayoutWrapper>
        </SiteSettingsProvider>
        {/*
         * Privacy-friendly Core Web Vitals reporter — no external service or key.
         * Fires web-vitals observers after hydration; beacons metrics to /api/vitals.
         */}
        <WebVitalsReporter />
      </body>
    </html>
  );
}
