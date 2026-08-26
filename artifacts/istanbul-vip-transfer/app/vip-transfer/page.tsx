import type { Metadata } from 'next';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import { SITE } from '@/lib/site-config';
import { getServiceOgImageUrl } from '@/lib/service-og-images';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/vip-transfer`;

const TITLE = 'VIP Transfer İstanbul | Vito ve Sprinter';
const DESCRIPTION = 'İstanbul\'da Mercedes Vito ve Sprinter araçlarla havalimanı, otel, kurumsal ve şehirler arası VIP transfer hizmeti.';

// This route must place core SEO metadata in the first HTML head. Awaiting CMS
// data in generateMetadata streams tags after the document head, which audit
// tools and crawlers can miss. Service body content remains CMS-driven.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: PAGE,
    languages: {
      'x-default': PAGE,
      'tr-TR': PAGE,
      'ar-SA': `${BASE}/ar/vip-transfer`,
      'de-DE': `${BASE}/de/vip-transfer`,
      'en-GB': `${BASE}/en/vip-transfer`,
      'es-ES': `${BASE}/es/vip-transfer`,
      'fr-FR': `${BASE}/fr/vip-transfer`,
      'it-IT': `${BASE}/it/vip-transfer`,
      'nl-NL': `${BASE}/nl/vip-transfer`,
      'ru-RU': `${BASE}/ru/vip-transfer`,
    },
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE,
    siteName: 'VIP Transfer Istanbul',
    locale: 'tr_TR',
    type: 'website',
    images: [{ url: getServiceOgImageUrl('vip-transfer', SITE.siteUrl), width: 1200, height: 630 }],
  },
  robots: { index: true, follow: true },
};

export default async function VipTransferPage() {
  return (
    <ServicePageRenderer slug="vip-transfer" lang="tr" canonicalPath="/vip-transfer" />
  );
}
