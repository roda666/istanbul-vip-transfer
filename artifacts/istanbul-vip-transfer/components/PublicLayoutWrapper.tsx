'use client';

/**
 * Conditionally renders the public site chrome (Header, Footer, WhatsApp button).
 * Admin routes get bare children with no public navigation.
 * Wraps public pages with LangProvider so Header, Footer, and BookingForm
 * can access the active language and dictionary.
 */
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import DeferredChatLauncher from './DeferredChatLauncher';
import BackToTop from './BackToTop';
import type { HomepageSections } from '@/lib/homepage-types';
import type {
  PublicServiceNavigationGroup,
  PublicServiceNavigationItem,
} from '@/lib/public-service-catalog-types';

import LangProvider from './LangProvider';
import CookieConsentBanner from './CookieConsentBanner';
import CollapsibleBookingForm from './CollapsibleBookingForm';
import { BookingFormDataProvider } from './BookingFormDataContext';
import type { BookingFormBootstrap } from '@/lib/booking-form-types';

// WhatsApp stays available independently of chat. ChatWidget is deliberately
// imported only by DeferredChatLauncher after a visitor clicks its launcher.
const WhatsAppFloat = dynamic(() => import('./WhatsAppFloat'), { ssr: false });

export default function PublicLayoutWrapper({
  children,
  serviceNavigationGroups,
  serviceLinks,
  initialLang,
  bookingFormData,
  hasCookieConsentDecision,
  homepageFooter,
}: {
  children: React.ReactNode;
  /** CMS-backed public navigation groups, fetched by the root server layout. */
  serviceNavigationGroups?: PublicServiceNavigationGroup[];
  /** CMS-backed service links for the footer. */
  serviceLinks?: PublicServiceNavigationItem[];
  /** Resolved by middleware so the shared public chrome hydrates consistently. */
  initialLang: string;
  /** Server-fetched catalogs, ready before any deferred booking form mounts. */
  bookingFormData: BookingFormBootstrap;
  /** Read server-side so the banner never appears as a late LCP candidate. */
  hasCookieConsentDecision: boolean;
  /** Footer is the sole homepage-CMS field used by public chrome. */
  homepageFooter: HomepageSections['footerSection'] | null;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');
  const normalizedPath = pathname && pathname !== '/' ? pathname.replace(/\/+$/, '') : pathname;
  const isHomepage = normalizedPath === '/' || normalizedPath === `/${initialLang}`;

  if (isAdmin) {
    // Admin pages manage their own layout
    return <>{children}</>;
  }

  return (
    <LangProvider forceLang={initialLang}>
      <BookingFormDataProvider data={bookingFormData}>
        <Header serviceNavigationGroups={serviceNavigationGroups} />
        <main>
          {children}
          {!isHomepage && <CollapsibleBookingForm />}
        </main>
        <Footer serviceLinks={serviceLinks} homepageFooter={homepageFooter} />
        <WhatsAppFloat />
        <DeferredChatLauncher />
        <BackToTop />
        <CookieConsentBanner hasInitialDecision={hasCookieConsentDecision} />
      </BookingFormDataProvider>
    </LangProvider>
  );
}
