'use client';

/**
 * Conditionally renders the public site chrome (Header, Footer, WhatsApp button).
 * Admin routes get bare children with no public navigation.
 * Wraps public pages with LangProvider so Header, Footer, and BookingForm
 * can access the active language and dictionary.
 */
import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';

import WhatsAppFloat from './WhatsAppFloat';
import ChatWidget from './ChatWidget';
import LangProvider from './LangProvider';
import CookieConsentBanner from './CookieConsentBanner';

export default function PublicLayoutWrapper({
  children,
  hiddenNavSlugs,
}: {
  children: React.ReactNode;
  /** Slugs where admin set showInNav=false — fetched by root server layout. */
  hiddenNavSlugs?: string[];
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  if (isAdmin) {
    // Admin pages manage their own layout
    return <>{children}</>;
  }

  return (
    <LangProvider>
      <Header hiddenNavSlugs={hiddenNavSlugs} />
      <main>{children}</main>
      <Footer hiddenNavSlugs={hiddenNavSlugs} />
      <WhatsAppFloat />
      <ChatWidget />
      <CookieConsentBanner />
    </LangProvider>
  );
}
