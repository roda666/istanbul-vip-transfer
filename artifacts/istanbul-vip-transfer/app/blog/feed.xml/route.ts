/**
 * GET /blog/feed.xml — RSS 2.0 feed for Turkish blog posts
 */
import { NextResponse } from 'next/server';
import { getPublishedBlogPosts } from '@/lib/blog-cms';
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

export async function GET() {
  const BASE = SITE.siteUrl;
  const posts = await getPublishedBlogPosts();

  const items = posts.map(post => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${BASE}/blog/${post.slug}</link>
      <guid isPermaLink="true">${BASE}/blog/${post.slug}</guid>
      <description>${escapeXml(post.excerpt ?? post.seoDescription ?? '')}</description>
      ${post.publishedAt ? `<pubDate>${post.publishedAt.toUTCString()}</pubDate>` : ''}
      ${post.category ? `<category>${escapeXml(post.category)}</category>` : ''}
      ${post.author ? `<author>${escapeXml(post.author)}</author>` : ''}
    </item>`).join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml('İstanbul VIP Transfer — Blog')}</title>
    <link>${BASE}/blog</link>
    <description>${escapeXml('İstanbul havalimanı transferi, VIP ulaşım ve araç seçimi hakkında rehberler.')}</description>
    <language>tr</language>
    <atom:link href="${BASE}/blog/feed.xml" rel="self" type="application/rss+xml"/>
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
