import type { Metadata, Viewport } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import './globals.css';
import PublicLayoutWrapper from '@/components/PublicLayoutWrapper';
import WebVitalsReporter from '@/components/WebVitalsReporter';
import GoogleAnalyticsConsent from '@/components/GoogleAnalyticsConsent';
import { SITE } from '@/lib/site-config';
import { getContactSettings } from '@/lib/site-settings-server';
import { SiteSettingsProvider } from '@/components/SiteSettingsContext';
import { cookies, headers } from 'next/headers';
import { getPublicLanguage } from '@/lib/i18n/active-locales';
import { getPublicChrome, type PublicChromePayload } from '@/lib/public-chrome';

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
  title: 'İstanbul VIP Transfer | Minivan, Minibüs ve Otobüs',
  description:
    'İstanbul VIP transfer hizmeti; İstanbul Havalimanı, Sabiha Gökçen, şehir içi ve şehirler arası minivan, minibüs, midibüs ve otobüs seçenekleri.',
  metadataBase: new URL(SITE.siteUrl),
  icons: {
    // SVG favicon for modern browsers (served via app/icon.svg)
    icon:  [{ url: '/icon.svg', type: 'image/svg+xml' }],
    // Apple touch icon (180×180 static PNG in public/)
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    // Classic ICO fallback for older browsers and bookmarks
    shortcut: [{ url: '/favicon.ico' }],
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    images: [SITE.ogImage],
  },
};

const EMPTY_PUBLIC_CHROME: PublicChromePayload = {
  contactSettings: {
    businessName: '', phoneDisplay: '', phoneTel: '', phoneE164: '', whatsappNumber: '',
    whatsappUrl: '', whatsappFloatUrl: '', email: '', emailMailto: '',
    googleBusinessUrl: '', companyLegalName: '', companyTradeName: '',
    tursabNo: '', fullAddress: '', googlePlayUrl: '', googleReviewUrl: '',
    tiktokUrl: '', youtubeUrl: '',
  },
  serviceNavigationGroups: [],
  serviceLinks: [],
  homepageFooter: null,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  // Only middleware-marked public documents read the shared chrome cache.
  // Admin routes remain request-specific and never populate/read that cache.
  const isPublicRequest = requestHeaders.has('x-ivt-lang');
  const requestedLang = requestHeaders.get('x-ivt-lang') ?? 'tr';
  const hasCookieConsentDecision = Boolean(cookieStore.get('ivt_cookie_consent')?.value);
  const activeLanguage = isPublicRequest ? await getPublicLanguage(requestedLang) : null;
  const initialLang = activeLanguage?.code ?? 'tr';
  const initialDirection = activeLanguage?.direction ?? 'ltr';

  const publicChrome = isPublicRequest
    ? await getPublicChrome(initialLang).catch((): PublicChromePayload => EMPTY_PUBLIC_CHROME)
    : { ...EMPTY_PUBLIC_CHROME, contactSettings: await getContactSettings() };

  return (
    <html lang={initialLang} dir={initialDirection} className={`${playfairDisplay.variable} ${inter.variable}`}>
      <body
        className="grain-overlay"
        style={{ backgroundColor: 'var(--pub-page-bg, #F7F5EF)', minHeight: '100dvh' }}
      >
        {/* PublicLayoutWrapper conditionally adds Header/Footer for public routes.
            Admin routes render their own layout without public chrome. */}
        <SiteSettingsProvider settings={publicChrome.contactSettings}>
          <PublicLayoutWrapper
            initialLang={initialLang}
            serviceNavigationGroups={publicChrome.serviceNavigationGroups}
            serviceLinks={publicChrome.serviceLinks}
            hasCookieConsentDecision={hasCookieConsentDecision}
            homepageFooter={publicChrome.homepageFooter}
          >
            {children}
          </PublicLayoutWrapper>
        </SiteSettingsProvider>
        {/*
         * Privacy-friendly Core Web Vitals reporter — no external service or key.
         * Fires web-vitals observers after hydration; beacons metrics to /api/vitals.
         */}
        <WebVitalsReporter />
        {/*
         * GA4 loads only after the visitor accepts cookies in the banner.
         * GoogleAnalyticsConsent is a client component that listens for the
         * 'ivt:consent:accepted' event dispatched by CookieConsentBanner.
         * If the cookie is already set 'accepted' it initialises GA on mount.
         * If the cookie is 'rejected' (or absent), GA is never loaded.
         */}
        <GoogleAnalyticsConsent />
      </body>
    </html>
  );
}
