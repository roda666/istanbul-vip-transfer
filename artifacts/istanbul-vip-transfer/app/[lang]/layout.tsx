/**
 * Layout for non-Turkish language routes: /en/*, /de/*, /ru/*, /ar/*
 *
 * Responsibilities:
 *  1. Validate the lang param — 404 for unknown/disabled languages
 *  2. Wrap children with LangProvider so page components get the right dictionary.
 *     The root layout receives the same locale from middleware and owns html lang/dir.
 */
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import LangProvider from '@/components/LangProvider';
import { isLocaleCodeSyntax } from '@/lib/i18n/locale-registry';
import { getPublicLanguage } from '@/lib/i18n/active-locales';
import { getPublicServiceCatalog } from '@/lib/public-service-catalog';

interface Props {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const language = await getPublicLanguage(lang);
  if (!language) return {};

  return {
    title: 'Istanbul VIP Transfer | Luxury Airport & City Transfers',
    description: 'Istanbul VIP Transfer — luxury airport transfers, intercity transport, and private tours with Mercedes Vito & Sprinter.',
    openGraph: {
      locale: language.locale,
    },
    other: {
      'content-language': lang,
    },
  };
}

export default async function LangLayout({ children, params }: Props) {
  const { lang } = await params;

  const language = await getPublicLanguage(lang);
  if (!language || lang === 'tr') {
    // Catalog language that exists but is not publicly active (or any other
    // locale-looking segment) → safe redirect to the Turkish root instead of
    // showing a broken page. Non-locale segments fall through to 404.
    if (isLocaleCodeSyntax(lang)) {
      // Reset the preference cookie too, so the edge middleware doesn't keep
      // bouncing "/" back to this inactive locale (redirect loop).
      redirect('/data/locale/reset');
    }
    // This dynamic segment is also the only root fallback for a service whose
    // CMS slug has no hand-authored route folder. Admit only a verified,
    // public Turkish service; arbitrary root segments still return a 404.
    if (!language) {
      const catalog = await getPublicServiceCatalog('tr');
      if (catalog.services.some((service) => service.slug === lang)) {
        return <LangProvider forceLang="tr">{children}</LangProvider>;
      }
    }
    notFound();
  }

  return (
    <LangProvider forceLang={lang}>
      {children}
    </LangProvider>
  );
}
