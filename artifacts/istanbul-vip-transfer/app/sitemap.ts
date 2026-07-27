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
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },

    // Airport transfer pages
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

    // Service pages
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

    // Info pages
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

    // Blog index
    {
      url: `${BASE}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.65,
    },

    // Blog articles
    {
      url: `${BASE}/blog/istanbul-havalimani-transfer-rehberi`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE}/blog/sabiha-gokcen-transfer-rehberi`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE}/blog/vip-transfer-ile-taksi-arasindaki-farklar`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];
}
