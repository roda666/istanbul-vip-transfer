/**
 * GET /[lang]/blog/feed.xml — Localized RSS 2.0 feed for translated blog posts
 */
import { NextRequest, NextResponse } from 'next/server';
import { isValidLang } from '@/lib/i18n';
import { getPublishedBlogTranslations } from '@/lib/blog-cms';
import { SITE } from '@/lib/site-config';

export const dynamic = 'force-dynamic';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface Props { params: Promise<{ lang: string }> }

export async function GET(_req: NextRequest, { params }: Props) {
  const { lang } = await params;
  if ((lang as string) === 'tr' || !isValidLang(lang)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const BASE = SITE.siteUrl;
  const posts = await getPublishedBlogTranslations(lang);

  const items = posts.map(post => {
    const slug = post.slug ?? post.sourceSlug;
    return `
    <item>
      <title>${escapeXml(post.title ?? post.sourceSlug)}</title>
      <link>${BASE}/${lang}/blog/${slug}</link>
      <guid isPermaLink="true">${BASE}/${lang}/blog/${slug}</guid>
      <description>${escapeXml(post.excerpt ?? '')}</description>
      ${post.publishedAt ? `<pubDate>${post.publishedAt.toUTCString()}</pubDate>` : ''}
    </item>`;
  }).join('\n');

  const feedTitle: Record<string, string> = {
    en: 'Istanbul VIP Transfer — Blog',
    de: 'Istanbul VIP Transfer — Blog',
    ru: 'Стамбул VIP Трансфер — Блог',
    ar: 'إسطنبول VIP ترانسفير — المدونة',
    es: 'Istanbul VIP Transfer — Blog',
    fr: 'Istanbul VIP Transfer — Blog',
    it: 'Istanbul VIP Transfer — Blog',
    nl: 'Istanbul VIP Transfer — Blog',
  };

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feedTitle[lang] ?? feedTitle.en)}</title>
    <link>${BASE}/${lang}/blog</link>
    <description>${escapeXml('Istanbul VIP Transfer blog articles.')}</description>
    <language>${lang}</language>
    <atom:link href="${BASE}/${lang}/blog/feed.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
