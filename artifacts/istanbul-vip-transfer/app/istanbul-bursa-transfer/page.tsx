import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/istanbul-bursa-transfer`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs('istanbul-bursa-transfer');
  const alts = await buildAlternates('/istanbul-bursa-transfer', publishedLangs);
  const cmsPage = await getPublishedServicePage('istanbul-bursa-transfer', 'tr');
  return {
    title: cmsPage?.title ?? 'İstanbul–Bursa Transfer | VIP Özel Araç',
    description:
      cmsPage?.excerpt ?? 'İstanbul\'dan Bursa\'ya veya Bursa\'dan İstanbul\'a Mercedes Vito ve Sprinter ile özel VIP transfer hizmeti. Kapıdan kapıya konforlu şehirler arası ulaşım.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'İstanbul–Bursa Transfer | VIP Özel Araç',
      description: cmsPage?.excerpt ?? 'İstanbul\'dan Bursa\'ya veya Bursa\'dan İstanbul\'a Mercedes Vito ve Sprinter ile özel VIP transfer hizmeti. Kapıdan kapıya konforlu şehirler arası ulaşım.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [SITE.ogImage],
    },
    robots: { index: false, follow: true },
  };
}

export default async function IstanbulBursaTransferPage() {
  return <ServicePageRenderer slug="istanbul-bursa-transfer" lang="tr" canonicalPath="/istanbul-bursa-transfer" />;
}
