import { describe, expect, it } from 'vitest';
import {
  appendServiceInlineImage,
  parseServicePageBody,
  type ServicePageBody,
} from '../../lib/service-page-types';

describe('service inline image attachment representation', () => {
  it('keeps a service body valid structured JSON after appending an image', () => {
    const body: ServicePageBody = {
      version: 1,
      hero: { badge: 'VIP', title: 'Transfer', subtitle: 'Konforlu yolculuk', crumb: 'Transfer', ctaPrimary: 'Rezervasyon', ctaSecondary: 'İletişim' },
      features: ['Özel araç'],
      seo: { ogTitle: 'Transfer', ogDescription: 'VIP transfer hizmeti' },
    };
    const attached = appendServiceInlineImage(body, {
      id: 'af0b82f3-4d78-4f52-9b1a-2d7eb221d1b8',
      src: '/api/storage/objects/ai-images/service/transfer/af0b82f3-4d78-4f52-9b1a-2d7eb221d1b8.webp',
      alt: 'VIP transfer aracı',
    });

    const parsed = parseServicePageBody(JSON.stringify(attached));
    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe(2);
    expect(parsed?.inlineImages).toEqual([{
      id: 'af0b82f3-4d78-4f52-9b1a-2d7eb221d1b8',
      src: '/api/storage/objects/ai-images/service/transfer/af0b82f3-4d78-4f52-9b1a-2d7eb221d1b8.webp',
      alt: 'VIP transfer aracı',
    }]);
  });
});