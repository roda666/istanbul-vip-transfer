import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import { SITE } from '@/lib/site-config';
import { getServiceOgImageUrl } from '@/lib/service-og-images';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/sehirler-arasi-transfer`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs('sehirler-arasi-transfer');
  const alts = await buildAlternates('/sehirler-arasi-transfer', publishedLangs);
  const cmsPage = await getPublishedServicePage('sehirler-arasi-transfer', 'tr');
  return {
    title: cmsPage?.title ?? 'Şehirler Arası VIP Transfer | İstanbul',
    description:
      cmsPage?.excerpt ?? 'İstanbul çıkışlı şehirler arası VIP transfer hizmeti. Mercedes Vito ve Sprinter araçlarla konforlu ve kapıdan kapıya özel ulaşım.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'Şehirler Arası VIP Transfer | İstanbul',
      description: cmsPage?.excerpt ?? 'İstanbul çıkışlı şehirler arası VIP transfer hizmeti. Mercedes Vito ve Sprinter araçlarla konforlu ve kapıdan kapıya özel ulaşım.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [{ url: getServiceOgImageUrl('sehirler-arasi-transfer', SITE.siteUrl), width: 1200, height: 630 }],
    },
    robots: { index: true, follow: true },
  };
}

export default async function SehirlerArasiTransferPage() {
  return <ServicePageRenderer slug="sehirler-arasi-transfer" lang="tr" canonicalPath="/sehirler-arasi-transfer" />;
}
