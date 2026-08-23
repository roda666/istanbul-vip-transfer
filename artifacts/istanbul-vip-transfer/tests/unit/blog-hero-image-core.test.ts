import { describe, expect, it } from 'vitest';
import {
  blogHeroObjectName,
  isBlogHeroEligible,
  mayGenerateAndWrite,
  validateBlogHeroImageBrief,
  validateBlogHeroImageConfig,
} from '@/lib/ai/blog-hero-image-core';

describe('blog hero image configuration', () => {
  it('accepts only explicit nonblank prompts and alt text', () => {
    expect(validateBlogHeroImageBrief({ prompt: '  prompt ', altText: ' alt ' })).toMatchObject({
      kind: 'valid', config: { prompt: 'prompt', altText: 'alt' },
    });
    expect(validateBlogHeroImageBrief({ prompt: '', altText: 'alt' })).toMatchObject({ kind: 'invalid' });
    expect(validateBlogHeroImageBrief({ prompt: 'prompt', altText: 'alt', extra: true })).toMatchObject({ kind: 'invalid' });
    expect(validateBlogHeroImageBrief({ prompt: 'prompt', altText: 'alt', enabled: false })).toMatchObject({ kind: 'disabled' });
  });

  it('does not create a prompt fallback for missing config', () => {
    const config = validateBlogHeroImageConfig({});
    expect(config).toBeInstanceOf(Map);
    expect((config as Map<string, unknown>).get('unconfigured-post')).toBeUndefined();
  });
});

describe('blog hero selection', () => {
  it('replaces missing/default/generic heroes or missing alt, but preserves custom accessible heroes', () => {
    expect(isBlogHeroEligible(null, 'Alt')).toBe(true);
    expect(isBlogHeroEligible('/images/blog/sabiha-gokcen-transfer-rehberi.jpg', 'Alt')).toBe(true);
    expect(isBlogHeroEligible('/custom.webp', '  ')).toBe(true);
    expect(isBlogHeroEligible('/custom.webp', 'Custom alt')).toBe(false);
  });

  it('uses only the permanent blog storage namespace', () => {
    expect(blogHeroObjectName('post-slug', '123')).toBe('ai-images/blog/post-slug/123.webp');
  });

  it('permits selection without any generation or write in dry-run mode', () => {
    expect(mayGenerateAndWrite(true)).toBe(false);
    expect(mayGenerateAndWrite(false)).toBe(true);
  });
});