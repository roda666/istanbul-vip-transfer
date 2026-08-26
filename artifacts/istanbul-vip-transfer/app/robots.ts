import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site-config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Explicit permission for OpenAI / ChatGPT bots (crawling, search, user-initiated fetches)
      { userAgent: 'GPTBot', allow: '/', disallow: ['/admin', '/data'] },
      { userAgent: 'OAI-SearchBot', allow: '/', disallow: ['/admin', '/data'] },
      { userAgent: 'ChatGPT-User', allow: '/', disallow: ['/admin', '/data'] },
      // Explicit permission for Anthropic / Claude bots
      { userAgent: 'ClaudeBot', allow: '/', disallow: ['/admin', '/data'] },
      { userAgent: 'Claude-User', allow: '/', disallow: ['/admin', '/data'] },
      { userAgent: 'Claude-SearchBot', allow: '/', disallow: ['/admin', '/data'] },
      // Explicit permission for Perplexity bots
      { userAgent: 'PerplexityBot', allow: '/', disallow: ['/admin', '/data'] },
      { userAgent: 'Perplexity-User', allow: '/', disallow: ['/admin', '/data'] },
      // Explicit permission for Google AI (Gemini / AI Overviews)
      { userAgent: 'Google-Extended', allow: '/', disallow: ['/admin', '/data'] },
      // General crawlers — block internal/API paths from all bots
      { userAgent: '*', allow: '/', disallow: ['/admin', '/admin/', '/admin/api', '/data', '/data/', '/api'] },
    ],
    sitemap: [`${SITE.siteUrl}/sitemap.xml`, `${SITE.siteUrl}/image-sitemap.xml`],
  };
}
