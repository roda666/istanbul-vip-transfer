import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import { getServiceHeroImage } from '@/lib/service-og-image';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import { SITE } from '@/lib/site-config';

const SLUG = 'vip-protokol-secim-araci';
const BASE = SITE.siteUrl;
const PAGE = `${BASE}/${SLUG}`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs(SLUG);
  const alts = await buildAlternates(`/${SLUG}`, publishedLangs);
  const cmsPage = await getPublishedServicePage(SLUG, 'tr');
  return {
    title: cmsPage?.title ?? 'VIP Protokol Aracı | Seçim Kampanya Araç Kiralama',
    description: cmsPage?.excerpt ?? 'Protokol transferleri ve seçim kampanyaları için özel şoförlü VIP araç tahsisi. Mercedes Vito ve Sprinter, diskret profesyonel hizmet.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'VIP Protokol ve Seçim Aracı | Kurumsal Araç Tahsisi',
      description: cmsPage?.excerpt ?? 'Kurumsal, siyasi ve protokol etkinlikleri için diskret VIP araç tahsisi.',
      url: PAGE, siteName: 'VIP Transfer Istanbul', locale: 'tr_TR', type: 'website', images: [getServiceHeroImage(SLUG)],
    },
    robots: { index: true, follow: true },
  };
}

export default function VipProtokolSecimPage() {
  return <ServicePageRenderer slug={SLUG} lang="tr" canonicalPath={`/${SLUG}`} />;
}
