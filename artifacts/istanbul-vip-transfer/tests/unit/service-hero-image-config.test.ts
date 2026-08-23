import { describe, expect, it } from 'vitest';
import {
  SERVICE_HERO_IMAGE_CONFIG,
  SERVICE_IMAGE_PROMPT_SUFFIX,
  getServiceHeroImageConfig,
} from '../../lib/ai/service-hero-image-config';

describe('service hero image configuration', () => {
  it('has explicit nonempty prompt and alternative text for every configured service', () => {
    for (const [slug, config] of Object.entries(SERVICE_HERO_IMAGE_CONFIG)) {
      expect(config.prompt, `${slug} prompt`).toContain(SERVICE_IMAGE_PROMPT_SUFFIX);
      expect(config.altText.trim(), `${slug} alt text`).not.toBe('');
    }
  });

  it('includes every audited missing service candidate', () => {
    for (const slug of [
      'ucus-karsilama-meet-greet',
      'ankara-vip-transfer',
      'antalya-vip-transfer',
      'izmir-vip-transfer',
      'gelin-arabasi-kiralama',
      'vip-protokol-secim-araci',
      'gunluk-villa-kiralama',
    ]) {
      expect(getServiceHeroImageConfig(slug)).not.toBeNull();
    }
  });

  it('has no generic fallback for unknown database service slugs', () => {
    expect(getServiceHeroImageConfig('unconfigured-service')).toBeNull();
  });
});