import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import { getServiceOgImageUrl } from '@/lib/service-og-images';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import { SITE } from '@/lib/site-config';

const SLUG = 'gelin-arabasi-kiralama';
const BASE = SITE.siteUrl;
const PAGE = `${BASE}/${SLUG}`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs(SLUG);
  const alts = await buildAlternates(`/${SLUG}`, publishedLangs);
  const cmsPage = await getPublishedServicePage(SLUG, 'tr');
  return {
    title: cmsPage?.title ?? 'Gelin Arabası Kiralama İstanbul | Düğün Mercedes VIP',
    description: cmsPage?.excerpt ?? 'İstanbul\'da lüks gelin arabası kiralama. Mercedes Vito ve Sprinter ile düğün transferi, özel süsleme, profesyonel şoför.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'Gelin Arabası Kiralama İstanbul | Lüks Düğün Mercedes',
      description: cmsPage?.excerpt ?? 'İstanbul\'da Mercedes Vito ve Sprinter ile lüks gelin arabası kiralama. Özel süsleme, profesyonel şoför.',
      url: PAGE, siteName: 'VIP Transfer Istanbul', locale: 'tr_TR', type: 'website',
      images: [{ url: getServiceOgImageUrl(SLUG, SITE.siteUrl), width: 1200, height: 630 }],
    },
    robots: { index: true, follow: true },
  };
}

export default function GelinArabasiPage() {
  return <ServicePageRenderer slug={SLUG} lang="tr" canonicalPath={`/${SLUG}`} />;
}
