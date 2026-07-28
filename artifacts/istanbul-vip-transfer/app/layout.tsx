import type { Metadata, Viewport } from 'next';
import './globals.css';
import PublicLayoutWrapper from '@/components/PublicLayoutWrapper';
import { SITE } from '@/lib/site-config';

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
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /*
     * suppressHydrationWarning is required because [lang]/layout.tsx
     * injects a synchronous <script> that updates html[lang] and html[dir]
     * for non-Turkish pages before React hydration. Without this attribute
     * React would warn about the attribute mismatch.
     */
    <html lang="tr" dir="ltr" suppressHydrationWarning>
      <body
        className="grain-overlay"
        style={{ backgroundColor: 'var(--pub-page-bg, #F7F5EF)', minHeight: '100dvh' }}
      >
        {/* PublicLayoutWrapper conditionally adds Header/Footer for public routes.
            Admin routes render their own layout without public chrome. */}
        <PublicLayoutWrapper>{children}</PublicLayoutWrapper>
      </body>
    </html>
  );
}
