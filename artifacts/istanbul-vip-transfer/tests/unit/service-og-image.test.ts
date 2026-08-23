import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGE_REGISTRY } from '@/lib/page-registry';
import { getRegisteredServiceHeroSlugs, getServiceHeroImage } from '@/lib/service-og-image';
import { getServiceOgImageUrl, SERVICE_OG_IMAGES } from '@/lib/service-og-images';

describe('service social preview images', () => {
  const registeredServiceSlugs = [
    ...Object.entries(PAGE_REGISTRY)
    .filter(([, page]) => page.schemaType === 'Service')
    .map(([slug]) => slug),
    'ucus-karsilama-meet-greet',
  ].sort();

  it('maps every registered service to its own hero image', () => {
    expect(getRegisteredServiceHeroSlugs().sort()).toEqual(registeredServiceSlugs);

    for (const slug of registeredServiceSlugs) {
      expect(getServiceHeroImage(slug)).toBe(
        `https://www.istanbulviptransfer.com/hero-images/${slug}.jpg`,
      );
      expect(getServiceHeroImage(slug)).not.toContain('/images/istanbul-vip-transfer-hero.webp');
    }
  });

  it('ships every mapped social image as a public asset', () => {
    for (const slug of registeredServiceSlugs) {
      expect(existsSync(join(process.cwd(), 'public', 'hero-images', `${slug}.jpg`))).toBe(true);
    }
  });

  it('keeps distinct services on distinct social preview images', () => {
    expect(getServiceHeroImage('istanbul-havalimani-transfer'))
      .not.toBe(getServiceHeroImage('vip-transfer'));
    expect(getServiceHeroImage('vip-transfer'))
      .not.toBe(getServiceHeroImage('saglik-turizmi-transfer'));
  });

  it('fails explicitly instead of falling back to the generic social image', () => {
    expect(() => getServiceHeroImage('unregistered-service')).toThrow(
      'Missing service-specific hero image',
    );
    expect(() => getServiceOgImageUrl('unregistered-service', 'https://example.com')).toThrow(
      'Missing service-specific hero image',
    );
  });

  it('ships a branded social card for every service hero', () => {
    expect(Object.keys(SERVICE_OG_IMAGES).sort()).toEqual(registeredServiceSlugs);

    for (const slug of registeredServiceSlugs) {
      expect(SERVICE_OG_IMAGES[slug]).toBe(`/images/og/og-${slug}.jpg`);
      expect(existsSync(join(process.cwd(), 'public', 'images', 'og', `og-${slug}.jpg`))).toBe(true);
    }
  });
});