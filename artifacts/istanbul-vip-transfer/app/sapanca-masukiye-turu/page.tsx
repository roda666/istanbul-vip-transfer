import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import { SITE } from '@/lib/site-config';
import { getServiceOgImageUrl } from '@/lib/service-og-images';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/sapanca-masukiye-turu`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs('sapanca-masukiye-turu');
  const alts = await buildAlternates('/sapanca-masukiye-turu', publishedLangs);
  const cmsPage = await getPublishedServicePage('sapanca-masukiye-turu', 'tr');
  return {
    title: cmsPage?.title ?? 'Sapanca–Maşukiye Günübirlik Turu | VIP Transfer',
    description:
      cmsPage?.excerpt ?? 'İstanbul\'dan Sapanca Gölü ve Maşukiye\'ye özel araçla günübirlik tur. Doğa içinde konforlu bir gün geçirmek için Mercedes ile VIP tur hizmeti.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'Sapanca–Maşukiye Günübirlik Turu | VIP Transfer',
      description: cmsPage?.excerpt ?? 'İstanbul\'dan Sapanca Gölü ve Maşukiye\'ye özel araçla günübirlik tur. Doğa içinde konforlu bir gün geçirmek için Mercedes ile VIP tur hizmeti.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [{ url: getServiceOgImageUrl('sapanca-masukiye-turu', SITE.siteUrl), width: 1200, height: 630 }],
    },
    // Indexed as of 2026-08-27: content, images, FAQ, and schema for this page are complete.
    robots: { index: true, follow: true },
  };
}

export default async function SapancaMasukiyeTuruPage() {
  return <ServicePageRenderer slug="sapanca-masukiye-turu" lang="tr" canonicalPath="/sapanca-masukiye-turu" />;
}
