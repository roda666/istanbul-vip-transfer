/**
 * Turkish-language legal page route.
 * URL: /yasal/[slug]  e.g. /yasal/kvkk-aydinlatma-metni
 */
import type { Metadata } from 'next';
import { notFound }       from 'next/navigation';
import { getLegalPage, isLegalSlug, LEGAL_SLUGS } from '@/lib/legal-page-cms';
import LegalPageRenderer  from '@/components/LegalPageRenderer';
import { SITE }           from '@/lib/site-config';
import { SUPPORTED_LANGS } from '@/lib/i18n';

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return LEGAL_SLUGS.map(slug => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isLegalSlug(slug)) return {};
  const page = await getLegalPage(slug);
  if (!page) return {};

  const canonical = `${SITE.siteUrl}/yasal/${slug}`;
  const languages: Record<string, string> = { 'tr': canonical };
  for (const lang of SUPPORTED_LANGS) {
    languages[lang] = `${SITE.siteUrl}/${lang}/yasal/${slug}`;
  }

  return {
    title:       `${page.title} | Istanbul VIP Transfer`,
    description: page.excerpt,
    alternates:  { canonical, languages },
    openGraph: {
      title:       `${page.title} | Istanbul VIP Transfer`,
      description: page.excerpt,
      url:         canonical,
      siteName:    'Istanbul VIP Transfer',
      locale:      'tr_TR',
      type:        'website',
    },
    robots: { index: true, follow: true },
  };
}

export default async function LegalPageTR({ params }: Props) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();
  const page = await getLegalPage(slug);
  if (!page) notFound();
  return <LegalPageRenderer page={page} lang="tr" slug={slug} />;
}
