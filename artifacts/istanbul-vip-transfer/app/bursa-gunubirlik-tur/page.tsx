import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import { SITE } from '@/lib/site-config';
import { getServiceOgImageUrl } from '@/lib/service-og-images';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/bursa-gunubirlik-tur`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs('bursa-gunubirlik-tur');
  const alts = await buildAlternates('/bursa-gunubirlik-tur', publishedLangs);
  const cmsPage = await getPublishedServicePage('bursa-gunubirlik-tur', 'tr');
  return {
    title: cmsPage?.title ?? 'Bursa Günübirlik Tur | İstanbul\'dan VIP Transfer',
    description:
      cmsPage?.excerpt ?? 'İstanbul\'dan Bursa\'ya özel araçla günübirlik tur. Yeşil Bursa\'yı kendi programınıza göre keşfetmek için Mercedes VIP tur transferi.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'Bursa Günübirlik Tur | İstanbul\'dan VIP Transfer',
      description: cmsPage?.excerpt ?? 'İstanbul\'dan Bursa\'ya özel araçla günübirlik tur. Yeşil Bursa\'yı kendi programınıza göre keşfetmek için Mercedes VIP tur transferi.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [{ url: getServiceOgImageUrl('bursa-gunubirlik-tur', SITE.siteUrl), width: 1200, height: 630 }],
    },
    // Indexed as of 2026-08-27: content, images, FAQ, and schema for this page are complete.
    robots: { index: true, follow: true },
  };
}

export default async function BursaGunubirlikTurPage() {
  return <ServicePageRenderer slug="bursa-gunubirlik-tur" lang="tr" canonicalPath="/bursa-gunubirlik-tur" />;
}
