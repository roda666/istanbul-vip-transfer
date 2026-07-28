/**
 * Layout for non-Turkish language routes: /en/*, /de/*, /ru/*, /ar/*
 *
 * Responsibilities:
 *  1. Validate the lang param — 404 for unknown/disabled languages
 *  2. Inject an inline script that updates html[lang] and html[dir] synchronously
 *     (root app/layout.tsx has suppressHydrationWarning so React won't complain)
 *  3. Wrap children with LangProvider so client components get the right dictionary
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import LangProvider from '@/components/LangProvider';
import { isValidLang, getLangDir, LANG_LOCALES } from '@/lib/i18n';

interface Props {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isValidLang(lang)) return {};

  const locale = LANG_LOCALES[lang as keyof typeof LANG_LOCALES] ?? 'en-GB';

  return {
    title: 'Istanbul VIP Transfer | Luxury Airport & City Transfers',
    description: 'Istanbul VIP Transfer — luxury airport transfers, intercity transport, and private tours with Mercedes Vito & Sprinter.',
    openGraph: {
      locale,
    },
    other: {
      'content-language': lang,
    },
  };
}

export default async function LangLayout({ children, params }: Props) {
  const { lang } = await params;

  // Only allow valid non-Turkish lang codes
  if (!isValidLang(lang)) {
    notFound();
  }

  const dir = getLangDir(lang);

  return (
    <>
      {/*
        This script runs synchronously during HTML parsing, BEFORE React hydration.
        It updates the <html lang> and <html dir> attributes that the root layout
        has set to "tr" / "ltr". The root layout's suppressHydrationWarning prevents
        React from warning about the attribute mismatch.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var h=document.documentElement;h.setAttribute('lang','${lang}');h.setAttribute('dir','${dir}');})();`,
        }}
      />
      <LangProvider forceLang={lang}>
        {children}
      </LangProvider>
    </>
  );
}
