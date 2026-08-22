import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import RelatedBlogSection from '@/components/RelatedBlogSection';
import { SITE } from '@/lib/site-config';
import { getServiceOgImageUrl } from '@/lib/service-og-images';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/istanbul-havalimani-transfer`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs('istanbul-havalimani-transfer');
  const alts = await buildAlternates('/istanbul-havalimani-transfer', publishedLangs);
  const cmsPage = await getPublishedServicePage('istanbul-havalimani-transfer', 'tr');
  return {
    title: cmsPage?.title ?? 'İstanbul Havalimanı Transfer | VIP Vito',
    description:
      cmsPage?.excerpt ?? 'İstanbul Havalimanı transfer hizmetiyle Mercedes Vito ve Sprinter araçlarla otel, ev ve istediğiniz adrese özel ulaşım.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'İstanbul Havalimanı Transfer | VIP Vito',
      description: cmsPage?.excerpt ?? 'İstanbul Havalimanı transfer hizmetiyle Mercedes Vito ve Sprinter araçlarla otel, ev ve istediğiniz adrese özel ulaşım.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [{ url: getServiceOgImageUrl('istanbul-havalimani-transfer', SITE.siteUrl), width: 1200, height: 630 }],
    },
    robots: { index: true, follow: true },
  };
}

export default async function IstanbulHavalimaniPage() {
  return (
    <>
      <ServicePageRenderer slug="istanbul-havalimani-transfer" lang="tr" canonicalPath="/istanbul-havalimani-transfer" />

      <RelatedBlogSection page="istanbul-havalimani-transfer" lang="tr" />
    </>
  );
}
