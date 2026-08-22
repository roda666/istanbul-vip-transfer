import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import RelatedBlogSection from '@/components/RelatedBlogSection';
import { SITE } from '@/lib/site-config';
import { getServiceOgImageUrl } from '@/lib/service-og-images';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/vip-transfer`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs('vip-transfer');
  const alts = await buildAlternates('/vip-transfer', publishedLangs);
  const cmsPage = await getPublishedServicePage('vip-transfer', 'tr');
  const title = cmsPage?.title?.trim() || 'VIP Transfer İstanbul | Vito ve Sprinter';
  const description = cmsPage?.excerpt?.trim()
    || 'İstanbul\'da Mercedes Vito ve Sprinter araçlarla havalimanı, otel, kurumsal ve şehirler arası VIP transfer hizmeti.';
  return {
    title,
    description,
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title,
      description,
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [{ url: getServiceOgImageUrl('vip-transfer', SITE.siteUrl), width: 1200, height: 630 }],
    },
    robots: { index: true, follow: true },
  };
}

export default async function VipTransferPage() {
  return (
    <>
      <ServicePageRenderer slug="vip-transfer" lang="tr" canonicalPath="/vip-transfer" />

      <RelatedBlogSection page="vip-transfer" lang="tr" />
    </>
  );
}
