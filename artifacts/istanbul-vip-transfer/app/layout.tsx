import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WhatsAppFloat from '@/components/WhatsAppFloat';
import { SITE } from '@/lib/site-config';

export const metadata: Metadata = {
  // Plain string fallback — all public pages set their own complete title.
  title: 'İstanbul VIP Transfer | Vito ve Sprinter Hizmeti',
  description:
    'İstanbul VIP transfer hizmeti; İstanbul Havalimanı, Sabiha Gökçen, şehir içi ve şehirler arası Mercedes Vito ve Sprinter ulaşımı.',
  metadataBase: new URL(SITE.siteUrl),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body
        className="grain-overlay"
        style={{ backgroundColor: '#0A0A0A', minHeight: '100dvh' }}
      >
        <Header />
        <main>{children}</main>
        <Footer />
        <WhatsAppFloat />
      </body>
    </html>
  );
}
