import { describe, expect, it } from 'vitest';
import {
  FOOTER_DIRECT_SERVICE_LIMIT,
  selectFooterServiceLinks,
} from '@/lib/footer-service-links';

const allServices = [
  { slug: 'yalova-gunubirlik-tur', label: 'Yalova' },
  { slug: 'istanbul-havalimani-transfer', label: 'İstanbul Havalimanı Transfer' },
  { slug: 'sabiha-gokcen-havalimani-transfer', label: 'Sabiha Gökçen Transfer' },
  { slug: 'vip-transfer', label: 'VIP Transfer' },
  { slug: 'sehirler-arasi-transfer', label: 'Şehirler Arası Transfer' },
  { slug: 'soforlu-arac-kiralama', label: 'Şoförlü Araç Kiralama' },
  { slug: 'otel-transfer', label: 'Otel Transferi' },
  { slug: 'istanbul-sapanca-transfer', label: 'Sapanca Transferi' },
];

describe('selectFooterServiceLinks', () => {
  it('keeps the compact footer list focused on priority services', () => {
    expect(selectFooterServiceLinks(allServices).map((service) => service.slug)).toEqual([
      'istanbul-havalimani-transfer',
      'sabiha-gokcen-havalimani-transfer',
      'vip-transfer',
      'soforlu-arac-kiralama',
      'sehirler-arasi-transfer',
      'otel-transfer',
    ]);
  });

  it('uses CMS ordering as a fallback while retaining the six-link limit', () => {
    const availableServices = [
      { slug: 'vip-transfer', label: 'VIP Transfer' },
      { slug: 'istanbul-bursa-transfer', label: 'Bursa Transferi' },
      { slug: 'istanbul-sapanca-transfer', label: 'Sapanca Transferi' },
      { slug: 'gelin-arabasi-kiralama', label: 'Gelin Arabası' },
      { slug: 'ankara-vip-transfer', label: 'Ankara VIP Transfer' },
      { slug: 'antalya-vip-transfer', label: 'Antalya VIP Transfer' },
      { slug: 'izmir-vip-transfer', label: 'İzmir VIP Transfer' },
    ];

    expect(selectFooterServiceLinks(availableServices)).toEqual([
      availableServices[0],
      availableServices[1],
      availableServices[2],
      availableServices[3],
      availableServices[4],
      availableServices[5],
    ]);
    expect(selectFooterServiceLinks(availableServices)).toHaveLength(FOOTER_DIRECT_SERVICE_LIMIT);
  });
});