import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ServiceCategoryPageContent, { getServiceCategoryPageCopy } from '@/components/ServiceCategoryPageContent';
import { getServiceCategories } from '@/lib/service-category-server';
import { buildServiceCategoryAlternates, getOgLocale } from '@/lib/i18n/seo';
import { localizedServiceCategoryPath } from '@/lib/localized-service-path';
import { SITE } from '@/lib/site-config';

interface Props {
  params: Promise<{ category: string }>;
}

async function getCategory(categorySlug: string) {
  const categories = await getServiceCategories('tr');
  return categories.find((category) => category.slug === categorySlug) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = await getCategory(categorySlug);
  if (!category) return {};

  const copy = getServiceCategoryPageCopy('tr');
  const alternates = await buildServiceCategoryAlternates(category.slug);
  const path = localizedServiceCategoryPath(category.slug, 'tr');
  const url = `${SITE.siteUrl}${path}`;
  const title = `${category.label} | İstanbul VIP Transfer`;
  const description = `${category.label} — ${copy.intro}`;

  return {
    title,
    description,
    alternates: { canonical: url, languages: alternates.languages },
    openGraph: {
      title, description, url, siteName: 'VIP Transfer Istanbul',
      locale: getOgLocale('tr'), type: 'website', images: [SITE.ogImage],
    },
    robots: { index: true, follow: true },
  };
}

export default async function TurkishServiceCategoryPage({ params }: Props) {
  const { category: categorySlug } = await params;
  const category = await getCategory(categorySlug);
  if (!category) notFound();

  return <ServiceCategoryPageContent locale="tr" category={category} />;
}