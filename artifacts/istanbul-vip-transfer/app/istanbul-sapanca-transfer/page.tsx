import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import { SITE } from '@/lib/site-config';
import { getServiceOgImageUrl } from '@/lib/service-og-images';

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
      images: [{ url: getServiceOgImageUrl('istanbul-sapanca-transfer', SITE.siteUrl), width: 1200, height: 630 }],
    },
    // Indexed as of 2026-08-27: content, images, FAQ, and schema for this page are complete.
    robots: { index: true, follow: true },
  };
}

export default async function IstanbulSapancaTransferPage() {
  return <ServicePageRenderer slug="istanbul-sapanca-transfer" lang="tr" canonicalPath="/istanbul-sapanca-transfer" />;
}
