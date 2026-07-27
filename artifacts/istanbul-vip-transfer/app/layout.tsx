import type { Metadata } from 'next';
import './globals.css';
import PublicLayoutWrapper from '@/components/PublicLayoutWrapper';
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
        {/* PublicLayoutWrapper conditionally adds Header/Footer for public routes.
            Admin routes render their own layout without public chrome. */}
        <PublicLayoutWrapper>{children}</PublicLayoutWrapper>
      </body>
    </html>
  );
}
