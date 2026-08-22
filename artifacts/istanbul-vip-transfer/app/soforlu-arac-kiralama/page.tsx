import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import { getServiceHeroImage } from '@/lib/service-og-image';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/soforlu-arac-kiralama`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs('soforlu-arac-kiralama');
  const alts = await buildAlternates('/soforlu-arac-kiralama', publishedLangs);
  const cmsPage = await getPublishedServicePage('soforlu-arac-kiralama', 'tr');
  return {
    title: cmsPage?.title ?? 'Şoförlü Araç Kiralama İstanbul | Günlük VIP Şoför Hizmeti',
    description:
      cmsPage?.excerpt ?? 'İstanbul\'da şoförlü araç kiralama hizmeti. Saatlik veya günlük olarak Mercedes Vito veya Sprinter ile toplantı, alışveriş ve etkinlik transferleri.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'Şoförlü Araç Kiralama İstanbul | Günlük VIP Şoför Hizmeti',
      description: cmsPage?.excerpt ?? 'İstanbul\'da şoförlü araç kiralama hizmeti. Saatlik veya günlük olarak Mercedes Vito veya Sprinter ile toplantı, alışveriş ve etkinlik transferleri.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [getServiceHeroImage('soforlu-arac-kiralama')],
    },
    robots: { index: true, follow: true },
  };
}

export default async function SoforluAracKiralamaPage() {
  return <ServicePageRenderer slug="soforlu-arac-kiralama" lang="tr" canonicalPath="/soforlu-arac-kiralama" />;
}
