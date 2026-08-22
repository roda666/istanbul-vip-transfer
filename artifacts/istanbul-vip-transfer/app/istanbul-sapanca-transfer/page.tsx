import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import { getServiceHeroImage } from '@/lib/service-og-image';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/istanbul-sapanca-transfer`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs('istanbul-sapanca-transfer');
  const alts = await buildAlternates('/istanbul-sapanca-transfer', publishedLangs);
  const cmsPage = await getPublishedServicePage('istanbul-sapanca-transfer', 'tr');
  return {
    title: cmsPage?.title ?? 'İstanbul–Sapanca Transfer | VIP Özel Araç',
    description:
      cmsPage?.excerpt ?? 'İstanbul\'dan Sapanca\'ya veya Sapanca\'dan İstanbul\'a Mercedes Vito ve Sprinter ile özel VIP transfer hizmeti. Kapıdan kapıya konforlu şehirler arası ulaşım.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'İstanbul–Sapanca Transfer | VIP Özel Araç',
      description: cmsPage?.excerpt ?? 'İstanbul\'dan Sapanca\'ya veya Sapanca\'dan İstanbul\'a Mercedes Vito ve Sprinter ile özel VIP transfer hizmeti. Kapıdan kapıya konforlu şehirler arası ulaşım.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [getServiceHeroImage('istanbul-sapanca-transfer')],
    },
    robots: { index: false, follow: true },
  };
}

export default async function IstanbulSapancaTransferPage() {
  return <ServicePageRenderer slug="istanbul-sapanca-transfer" lang="tr" canonicalPath="/istanbul-sapanca-transfer" />;
}
