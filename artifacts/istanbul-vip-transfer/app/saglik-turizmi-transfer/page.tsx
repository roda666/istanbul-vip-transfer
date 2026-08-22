import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import { getServiceHeroImage } from '@/lib/service-og-image';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/saglik-turizmi-transfer`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs('saglik-turizmi-transfer');
  const alts = await buildAlternates('/saglik-turizmi-transfer', publishedLangs);
  const cmsPage = await getPublishedServicePage('saglik-turizmi-transfer', 'tr');
  return {
    title: cmsPage?.title ?? 'Sağlık Turizmi Transfer İstanbul | Hastane VIP Ulaşım',
    description:
      cmsPage?.excerpt ?? 'İstanbul\'a sağlık turizmi amacıyla gelen hastalar için havalimanından hastaneye, klinikten otele ve randevular arası özel Mercedes transfer hizmeti.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'Sağlık Turizmi Transfer İstanbul | Hastane VIP Ulaşım',
      description: cmsPage?.excerpt ?? 'İstanbul\'a sağlık turizmi amacıyla gelen hastalar için havalimanından hastaneye, klinikten otele ve randevular arası özel Mercedes transfer hizmeti.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [getServiceHeroImage('saglik-turizmi-transfer')],
    },
    robots: { index: true, follow: true },
  };
}

export default async function SaglikTurizmiTransferPage() {
  return <ServicePageRenderer slug="saglik-turizmi-transfer" lang="tr" canonicalPath="/saglik-turizmi-transfer" />;
}
