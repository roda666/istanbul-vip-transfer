import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import { getServiceHeroImage } from '@/lib/service-og-image';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/istanbul-gunubirlik-turlar`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs('istanbul-gunubirlik-turlar');
  const alts = await buildAlternates('/istanbul-gunubirlik-turlar', publishedLangs);
  const cmsPage = await getPublishedServicePage('istanbul-gunubirlik-turlar', 'tr');
  return {
    title: cmsPage?.title ?? 'İstanbul Günübirlik Turlar | VIP Özel Tur Aracı',
    description:
      cmsPage?.excerpt ?? 'İstanbul\'un tarihi ve kültürel mekânlarını özel araçla günübirlik keşfedin. Mercedes Vito ve Sprinter ile kişiye özel şehir turu hizmeti.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'İstanbul Günübirlik Turlar | VIP Özel Tur Aracı',
      description: cmsPage?.excerpt ?? 'İstanbul\'un tarihi ve kültürel mekânlarını özel araçla günübirlik keşfedin. Mercedes Vito ve Sprinter ile kişiye özel şehir turu hizmeti.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [getServiceHeroImage('istanbul-gunubirlik-turlar')],
    },
    robots: { index: false, follow: true },
  };
}

export default async function IstanbulGunubirlikTurlarPage() {
  return <ServicePageRenderer slug="istanbul-gunubirlik-turlar" lang="tr" canonicalPath="/istanbul-gunubirlik-turlar" />;
}
