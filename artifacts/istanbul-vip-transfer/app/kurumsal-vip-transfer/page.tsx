import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/kurumsal-vip-transfer`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs('kurumsal-vip-transfer');
  const alts = await buildAlternates('/kurumsal-vip-transfer', publishedLangs);
  const cmsPage = await getPublishedServicePage('kurumsal-vip-transfer', 'tr');
  return {
    title: cmsPage?.title ?? 'Kurumsal VIP Transfer İstanbul | Faturalı Şirket Transferi',
    description:
      cmsPage?.excerpt ?? 'İstanbul\'da kurumsal VIP transfer hizmeti. Yönetici ve iş misafiri transferlerinde fatura düzenleme, karşılama tabelası ve Mercedes araç tahsisi.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'Kurumsal VIP Transfer İstanbul | Faturalı Şirket Transferi',
      description: cmsPage?.excerpt ?? 'İstanbul\'da kurumsal VIP transfer hizmeti. Yönetici ve iş misafiri transferlerinde fatura düzenleme, karşılama tabelası ve Mercedes araç tahsisi.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [SITE.ogImage],
    },
    robots: { index: true, follow: true },
  };
}

export default async function KurumsalVipTransferPage() {
  return <ServicePageRenderer slug="kurumsal-vip-transfer" lang="tr" canonicalPath="/kurumsal-vip-transfer" />;
}
