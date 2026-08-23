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
import type { HomepageSections } from '@/lib/homepage-types';
import type {
  PublicServiceNavigationGroup,
  PublicServiceNavigationItem,
} from '@/lib/public-service-catalog-types';

import LangProvider from './LangProvider';
import CookieConsentBanner from './CookieConsentBanner';

// WhatsApp stays available independently of chat. ChatWidget is deliberately
// imported only by DeferredChatLauncher after a visitor clicks its launcher.
const WhatsAppFloat = dynamic(() => import('./WhatsAppFloat'), { ssr: false });

export default function PublicLayoutWrapper({
  children,
  serviceNavigationGroups,
  serviceLinks,
  initialLang,
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
  /** Read server-side so the banner never appears as a late LCP candidate. */
  hasCookieConsentDecision: boolean;
  /** Footer is the sole homepage-CMS field used by public chrome. */
  homepageFooter: HomepageSections['footerSection'] | null;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  if (isAdmin) {
    // Admin pages manage their own layout
    return <>{children}</>;
  }

  return (
    <LangProvider forceLang={initialLang}>
      <Header serviceNavigationGroups={serviceNavigationGroups} />
      <main>{children}</main>
      <Footer serviceLinks={serviceLinks} homepageFooter={homepageFooter} />
      <WhatsAppFloat />
      <DeferredChatLauncher />
      <CookieConsentBanner hasInitialDecision={hasCookieConsentDecision} />
    </LangProvider>
  );
}
