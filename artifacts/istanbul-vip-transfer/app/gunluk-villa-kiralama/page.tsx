import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import { SITE } from '@/lib/site-config';

const SLUG = 'gunluk-villa-kiralama';
const BASE = SITE.siteUrl;
const PAGE = `${BASE}/${SLUG}`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs(SLUG);
  const alts = await buildAlternates(`/${SLUG}`, publishedLangs);
  const cmsPage = await getPublishedServicePage(SLUG, 'tr');
  return {
    title: cmsPage?.title ?? 'Günlük Villa Kiralama İstanbul | VIP Günübirlik Villa',
    description: cmsPage?.excerpt ?? 'İstanbul çevresinde günlük kiralık lüks villa. Özel havuz, bahçe, korunaklı alan ve transfer hizmetiyle birlikte özel konaklama deneyimi.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'Günlük Villa Kiralama İstanbul | Özel Havuzlu VIP Villa',
      description: cmsPage?.excerpt ?? 'İstanbul çevresinde günlük lüks villa kiralama. Özel havuz, bahçe, transfer dahil.',
      url: PAGE, siteName: 'VIP Transfer Istanbul', locale: 'tr_TR', type: 'website', images: [SITE.ogImage],
    },
    robots: { index: true, follow: true },
  };
}

export default function GunlukVillaPage() {
  return <ServicePageRenderer slug={SLUG} lang="tr" canonicalPath={`/${SLUG}`} />;
}
