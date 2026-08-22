import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import { SITE } from '@/lib/site-config';
import { getServiceOgImageUrl } from '@/lib/service-og-images';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/yalova-gunubirlik-tur`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs('yalova-gunubirlik-tur');
  const alts = await buildAlternates('/yalova-gunubirlik-tur', publishedLangs);
  const cmsPage = await getPublishedServicePage('yalova-gunubirlik-tur', 'tr');
  return {
    title: cmsPage?.title ?? 'Yalova Günübirlik Tur | İstanbul\'dan VIP Transfer',
    description:
      cmsPage?.excerpt ?? 'İstanbul\'dan Yalova\'ya özel araçla günübirlik tur. Termal tatil bölgelerini ve doğal güzellikleri keşfetmek için Mercedes VIP tur transferi.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'Yalova Günübirlik Tur | İstanbul\'dan VIP Transfer',
      description: cmsPage?.excerpt ?? 'İstanbul\'dan Yalova\'ya özel araçla günübirlik tur. Termal tatil bölgelerini ve doğal güzellikleri keşfetmek için Mercedes VIP tur transferi.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [{ url: getServiceOgImageUrl('yalova-gunubirlik-tur', SITE.siteUrl), width: 1200, height: 630 }],
    },
    robots: { index: false, follow: true },
  };
}

export default async function YalovaGunubirlikTurPage() {
  return <ServicePageRenderer slug="yalova-gunubirlik-tur" lang="tr" canonicalPath="/yalova-gunubirlik-tur" />;
}
