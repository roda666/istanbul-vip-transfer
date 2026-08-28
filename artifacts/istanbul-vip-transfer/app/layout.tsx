import type { Metadata, Viewport } from 'next';
import { Playfair_Display, Inter, Noto_Sans_Arabic } from 'next/font/google';
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
import { getBookingFormInitialData } from '@/lib/booking-form-bootstrap';
import { EMPTY_BOOKING_FORM_INITIAL_DATA } from '@/lib/booking-form-types';

/**
 * Self-hosted via next/font — eliminates the external Google Fonts request
 * and associated layout shift / FOIT. CSS variable names map to the existing
 * --app-font-serif / --app-font-sans variables in globals.css.
 */
const playfairDisplay = Playfair_Display({
  subsets:  ['latin'],
  variable: '--font-playfair',
  display:  'swap',
  weight:   ['700'],
  style:    ['normal'],
});

const inter = Inter({
  subsets:  ['latin'],
  variable: '--font-inter',
  display:  'swap',
  weight:   ['300', '400', '500', '600', '700'],
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-noto-arabic',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  preload: false,
});

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  viewportFit:  'cover',   // expose safe-area-inset-* CSS env vars
  themeColor: [
    { media: '(max-width: 1279px)', color: '#3A4450' },
    { media: '(min-width: 1280px)', color: '#102A43' },
  ],
};

export const metadata: Metadata = {
  // Plain string fallback — all public pages set their own complete title.
  title: 'İstanbul VIP Transfer | Minivan, Minibüs ve Otobüs',
  description:
    'İstanbul VIP transfer hizmeti; İstanbul Havalimanı, Sabiha Gökçen, şehir içi ve şehirler arası minivan, minibüs, midibüs ve otobüs seçenekleri.',
  metadataBase: new URL(SITE.siteUrl),
  icons: {
    // Explicit PNG sizes keep browser, Android and crawler discovery deterministic.
    icon: [
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon-180.png', sizes: '180x180', type: 'image/png' }],
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

  const [publicChrome, bookingFormData] = isPublicRequest
    ? await Promise.all([
        getPublicChrome(initialLang).catch((): PublicChromePayload => EMPTY_PUBLIC_CHROME),
        getBookingFormInitialData(),
      ])
    : [
        { ...EMPTY_PUBLIC_CHROME, contactSettings: await getContactSettings() },
        EMPTY_BOOKING_FORM_INITIAL_DATA,
      ];

  return (
    <html
      lang={initialLang}
      dir={initialDirection}
      className={`${playfairDisplay.variable} ${inter.variable} ${notoSansArabic.variable}`}
    >
      <body
        className="grain-overlay"
        style={{ backgroundColor: 'var(--pub-page-bg, #F7F5EF)', minHeight: '100dvh' }}
      >
        {/* PublicLayoutWrapper conditionally adds Header/Footer for public routes.
            Admin routes render their own layout without public chrome. */}
        <SiteSettingsProvider settings={publicChrome.contactSettings}>
          <PublicLayoutWrapper
            initialLang={initialLang}
            bookingFormData={bookingFormData}
            serviceNavigationGroups={publicChrome.serviceNavigationGroups}
            serviceLinks={publicChrome.serviceLinks}
            hasCookieConsentDecision={hasCookieConsentDecision}
            homepageFooter={publicChrome.homepageFooter}
          >
            {children}
          </PublicLayoutWrapper>
        </SiteSettingsProvider>
        {/*
         * Core Web Vitals telemetry uses no external service or key, but still
         * begins only after the visitor accepts analytics cookies.
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
