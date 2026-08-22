'use client';

/**
 * Conditionally renders the public site chrome (Header, Footer, WhatsApp button).
 * Admin routes get bare children with no public navigation.
 * Wraps public pages with LangProvider so Header, Footer, and BookingForm
 * can access the active language and dictionary.
 */
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import type { HomepageSections } from '@/lib/homepage-types';

import LangProvider from './LangProvider';
import CookieConsentBanner from './CookieConsentBanner';

// Support widgets are useful after a visitor starts exploring, but they should
// not compete with the hero, reservation form, and navigation during first paint.
const WhatsAppFloat = dynamic(() => import('./WhatsAppFloat'), { ssr: false });
const ChatWidget = dynamic(() => import('./ChatWidget'), { ssr: false });

export default function PublicLayoutWrapper({
  children,
  hiddenNavSlugs,
  initialLang,
  hasCookieConsentDecision,
  homepageFooter,
}: {
  children: React.ReactNode;
  /** Slugs where admin set showInNav=false — fetched by root server layout. */
  hiddenNavSlugs?: string[];
  /** Resolved by middleware so the shared public chrome hydrates consistently. */
  initialLang: string;
  /** Read server-side so the banner never appears as a late LCP candidate. */
  hasCookieConsentDecision: boolean;
  /** Footer is the sole homepage-CMS field used by public chrome. */
  homepageFooter: HomepageSections['footerSection'] | null;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');
  const [supportWidgetsReady, setSupportWidgetsReady] = useState(false);

  useEffect(() => {
    if (isAdmin) return;

    const enableWidgets = () => setSupportWidgetsReady(true);
    const browserWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (typeof browserWindow.requestIdleCallback === 'function') {
      const idleId = browserWindow.requestIdleCallback(enableWidgets, { timeout: 3000 });
      return () => browserWindow.cancelIdleCallback?.(idleId);
    }

    const timer = window.setTimeout(enableWidgets, 1800);
    return () => window.clearTimeout(timer);
  }, [isAdmin]);

  if (isAdmin) {
    // Admin pages manage their own layout
    return <>{children}</>;
  }

  return (
    <LangProvider forceLang={initialLang}>
      <Header hiddenNavSlugs={hiddenNavSlugs} />
      <main>{children}</main>
      <Footer hiddenNavSlugs={hiddenNavSlugs} homepageFooter={homepageFooter} />
      {supportWidgetsReady && (
        <>
          <WhatsAppFloat />
          <ChatWidget />
        </>
      )}
      <CookieConsentBanner hasInitialDecision={hasCookieConsentDecision} />
    </LangProvider>
  );
}
