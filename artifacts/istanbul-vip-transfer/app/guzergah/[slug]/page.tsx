import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import TransferRouteDetail from '@/components/TransferRouteDetail';
import { getPublicTransferRoute } from '@/lib/transfer-route-pages';
import { buildTransferRouteAlternates, getOgLocale } from '@/lib/i18n/seo';
import { localizedTransferRoutePath } from '@/lib/localized-service-path';
import { SITE } from '@/lib/site-config';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const route = await getPublicTransferRoute(slug, 'tr');
  if (!route) return { robots: { index: false, follow: false } };

  const title = route.content.seoTitle || route.content.title;
  const description = route.content.seoDescription || route.content.description;
  const alternates = await buildTransferRouteAlternates(route.slug, route.publishedLocales);
  const url = `${SITE.siteUrl}${localizedTransferRoutePath(route.slug, 'tr')}`;

  return {
    title,
    description,
    alternates,
    openGraph: {
      title: route.content.ogTitle || title,
      description: route.content.ogDescription || description,
      url,
      siteName: 'VIP Transfer Istanbul',
      locale: getOgLocale('tr'),
      type: 'website',
      images: route.imagePath ? [route.imagePath] : [SITE.ogImage],
    },
    robots: { index: route.indexable, follow: true },
  };
}

export default async function TurkishTransferRoutePage({ params }: Props) {
  const { slug } = await params;
  const route = await getPublicTransferRoute(slug, 'tr');
  if (!route) notFound();
  return <TransferRouteDetail route={route} locale="tr" />;
}