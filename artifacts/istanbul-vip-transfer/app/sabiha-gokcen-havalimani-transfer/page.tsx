import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import { SITE } from '@/lib/site-config';
import { getServiceOgImageUrl } from '@/lib/service-og-images';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/sabiha-gokcen-havalimani-transfer`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs('sabiha-gokcen-havalimani-transfer');
  const alts = await buildAlternates('/sabiha-gokcen-havalimani-transfer', publishedLangs);
  const cmsPage = await getPublishedServicePage('sabiha-gokcen-havalimani-transfer', 'tr');
  return {
    title: cmsPage?.title ?? 'Sabiha Gökçen Transfer | VIP Vito',
    description:
      cmsPage?.excerpt ?? 'Sabiha Gökçen Havalimanı transfer hizmetiyle Mercedes Vito ve Sprinter araçlarla İstanbul\'un her noktasına özel ulaşım.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'Sabiha Gökçen Transfer | VIP Vito',
      description: cmsPage?.excerpt ?? 'Sabiha Gökçen Havalimanı transfer hizmetiyle Mercedes Vito ve Sprinter araçlarla İstanbul\'un her noktasına özel ulaşım.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [{ url: getServiceOgImageUrl('sabiha-gokcen-havalimani-transfer', SITE.siteUrl), width: 1200, height: 630 }],
    },
    robots: { index: true, follow: true },
  };
}

export default async function SabihaGokcenPage() {
  return (
    <ServicePageRenderer slug="sabiha-gokcen-havalimani-transfer" lang="tr" canonicalPath="/sabiha-gokcen-havalimani-transfer" />
  );
}
