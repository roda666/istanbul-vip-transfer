import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WhatsAppFloat from '@/components/WhatsAppFloat';
import { SITE } from '@/lib/site-config';

export const metadata: Metadata = {
  title: {
    default: 'İstanbul VIP Havalimanı Transfer | Mercedes ile Lüks Yolculuk',
    template: '%s | VIP Transfer Istanbul',
  },
  description:
    'İstanbul VIP havalimanı transfer hizmeti. Mercedes Vito ve Sprinter VIP ile İstanbul Havalimanı (IST) ve Sabiha Gökçen (SAW) transferleri. 7/24 WhatsApp ile rezervasyon.',
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
