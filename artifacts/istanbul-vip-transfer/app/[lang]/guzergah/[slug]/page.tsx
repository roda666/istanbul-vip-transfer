import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import TransferRouteDetail from '@/components/TransferRouteDetail';
import { isValidLang } from '@/lib/i18n';
import { buildTransferRouteAlternates, getOgLocale } from '@/lib/i18n/seo';
import { localizedTransferRoutePath } from '@/lib/localized-service-path';
import { getPublicTransferRoute } from '@/lib/transfer-route-pages';
import { SITE } from '@/lib/site-config';

interface Props {
  params: Promise<{ lang: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isValidLang(lang) || lang === 'tr') return { robots: { index: false, follow: false } };
  const route = await getPublicTransferRoute(slug, lang);
  if (!route) return { robots: { index: false, follow: false } };

  const title = route.content.seoTitle || route.content.title;
  const description = route.content.seoDescription || route.content.description;
  const alternates = await buildTransferRouteAlternates(route.slug, route.publishedLocales);
  const url = `${SITE.siteUrl}${localizedTransferRoutePath(route.slug, lang)}`;

  return {
    title,
    description,
    alternates: { canonical: url, languages: alternates.languages },
    openGraph: {
      title: route.content.ogTitle || title,
      description: route.content.ogDescription || description,
      url,
      siteName: 'VIP Transfer Istanbul',
      locale: getOgLocale(lang),
      type: 'website',
      images: route.imagePath ? [route.imagePath] : [SITE.ogImage],
    },
    robots: { index: route.indexable, follow: true },
  };
}

export default async function LocalizedTransferRoutePage({ params }: Props) {
  const { lang, slug } = await params;
  if (!isValidLang(lang) || lang === 'tr') notFound();
  const route = await getPublicTransferRoute(slug, lang);
  if (!route) notFound();
  return <TransferRouteDetail route={route} locale={lang} />;
}