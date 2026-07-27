import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;

/**
 * Only indexable, production-ready pages appear here.
 *
 * Excluded intentionally:
 *  - /istanbul-bursa-transfer, /istanbul-sapanca-transfer,
 *    /istanbul-gunubirlik-turlar, /sapanca-masukiye-turu,
 *    /bursa-gunubirlik-tur, /yalova-gunubirlik-tur  — noindex until content approved
 *  - /blog and /blog/[slug] — noindex until first article is approved
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    {
      url: `${BASE}/istanbul-havalimani-transfer`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE}/sabiha-gokcen-havalimani-transfer`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE}/vip-transfer`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE}/hizmetler`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE}/sehirler-arasi-transfer`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE}/soforlu-arac-kiralama`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.75,
    },
    {
      url: `${BASE}/otel-transfer`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.75,
    },
    {
      url: `${BASE}/saglik-turizmi-transfer`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.75,
    },
    {
      url: `${BASE}/kurumsal-vip-transfer`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.75,
    },
    {
      url: `${BASE}/araclar`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE}/hakkimizda`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE}/iletisim`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];
}
