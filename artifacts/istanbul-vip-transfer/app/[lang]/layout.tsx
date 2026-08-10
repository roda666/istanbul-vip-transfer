/**
 * Layout for non-Turkish language routes: /en/*, /de/*, /ru/*, /ar/*
 *
 * Responsibilities:
 *  1. Validate the lang param — 404 for unknown/disabled languages
 *  2. Inject an inline script that updates html[lang] and html[dir] synchronously
 *     (root app/layout.tsx has suppressHydrationWarning so React won't complain)
 *  3. Wrap children with LangProvider so client components get the right dictionary
 */
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import LangProvider from '@/components/LangProvider';
import { isValidLang, getLangDir, LANG_LOCALES } from '@/lib/i18n';
import { isPublicLang } from '@/lib/i18n/active-locales';

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

  // Only allow valid non-Turkish lang codes with static dictionaries
  if (!isValidLang(lang)) {
    // Catalog language that exists but is not publicly active (or any other
    // locale-looking segment) → safe redirect to the Turkish root instead of
    // showing a broken page. Non-locale segments fall through to 404.
    if (/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(lang)) {
      // Reset the preference cookie too, so the edge middleware doesn't keep
      // bouncing "/" back to this inactive locale (redirect loop).
      redirect('/data/locale/reset');
    }
    notFound();
  }

  // Defense in depth: a launched language that an admin disabled/unpublished
  // must stop being publicly reachable — redirect via the cookie-reset route
  // (a plain "/" redirect would loop with the middleware's cookie redirect).
  if (!(await isPublicLang(lang))) {
    redirect('/data/locale/reset');
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
