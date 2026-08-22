import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGE_REGISTRY } from '@/lib/page-registry';
import { getRegisteredServiceHeroSlugs, getServiceHeroImage } from '@/lib/service-og-image';

describe('service social preview images', () => {
  const registeredServiceSlugs = Object.entries(PAGE_REGISTRY)
    .filter(([, page]) => page.schemaType === 'Service')
    .map(([slug]) => slug)
    .sort();

  it('maps every registered service to its own hero image', () => {
    expect(getRegisteredServiceHeroSlugs().sort()).toEqual(registeredServiceSlugs);

    for (const slug of registeredServiceSlugs) {
      expect(getServiceHeroImage(slug)).toBe(
        `https://www.istanbulviptransfer.com/hero-images/${slug}.jpg`,
      );
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
});