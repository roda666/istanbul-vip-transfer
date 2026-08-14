import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/otel-transfer`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs('otel-transfer');
  const alts = await buildAlternates('/otel-transfer', publishedLangs);
  const cmsPage = await getPublishedServicePage('otel-transfer', 'tr');
  return {
    title: cmsPage?.title ?? 'Otel Transfer İstanbul | Havalimanı–Otel VIP Ulaşım',
    description:
      cmsPage?.excerpt ?? 'İstanbul\'da havalimanından otele, otelden havalimanına ve oteller arası Mercedes VIP transfer hizmeti. Karşılama tabelası ile kapıdan kapıya özel ulaşım.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'Otel Transfer İstanbul | Havalimanı–Otel VIP Ulaşım',
      description: cmsPage?.excerpt ?? 'İstanbul\'da havalimanından otele, otelden havalimanına ve oteller arası Mercedes VIP transfer hizmeti. Karşılama tabelası ile kapıdan kapıya özel ulaşım.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [SITE.ogImage],
    },
    robots: { index: true, follow: true },
  };
}

export default async function OtelTransferPage() {
  return <ServicePageRenderer slug="otel-transfer" lang="tr" canonicalPath="/otel-transfer" />;
}
