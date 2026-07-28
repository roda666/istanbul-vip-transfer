/**
 * Catch-all for /[lang]/[...slug] paths that don't have a dedicated translated page.
 *
 * When a visitor switches language (e.g. from /hizmetler to /en/hizmetler) and no
 * translated version exists, we redirect them back to the Turkish root equivalent so
 * they land on real content rather than a 404.
 *
 * Turkish stays at root (/), so /en/hizmetler → /hizmetler, /de/blog → /blog, etc.
 */
import { redirect, notFound } from 'next/navigation';
import { isValidLang } from '@/lib/i18n';

interface Props {
  params: Promise<{ lang: string; slug: string[] }>;
}

export default async function LangCatchAllPage({ params }: Props) {
  const { lang, slug } = await params;

  // If lang is not a known language code, let Next.js 404 naturally
  if (!isValidLang(lang)) notFound();

  // Redirect to the Turkish (root) equivalent path
  const rootPath = '/' + slug.join('/');
  redirect(rootPath);
}

// Don't attempt static generation — this is a dynamic redirect handler
export const dynamic = 'force-dynamic';
