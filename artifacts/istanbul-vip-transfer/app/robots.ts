import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site-config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Explicit permission for OpenAI / ChatGPT bots (crawling, search, user-initiated fetches)
      { userAgent: 'GPTBot', allow: '/', disallow: ['/admin', '/data'] },
      { userAgent: 'OAI-SearchBot', allow: '/', disallow: ['/admin', '/data'] },
      { userAgent: 'ChatGPT-User', allow: '/', disallow: ['/admin', '/data'] },
      // General crawlers
      { userAgent: '*', allow: '/', disallow: [] },
    ],
    sitemap: `${SITE.siteUrl}/sitemap.xml`,
  };
}
