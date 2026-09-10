import { describe, expect, it } from 'vitest';
import { normalizeRequiredTranslationFields, TranslationOutputSchema } from '@/lib/ai/translate';

describe('translation output normalization', () => {
  it('fills blank SEO fields from translated title and excerpt', () => {
    const normalized = normalizeRequiredTranslationFields({
      title: 'Translated title',
      slug: 'translated-title',
      excerpt: 'Translated summary',
      body: 'Translated body',
      metaTitle: '',
      metaDescription: '   ',
      focusKeyword: '',
      supportingKeywords: [],
      imageAlt: '',
      imageTitle: '',
      imageCaption: '',
    });

    const parsed = TranslationOutputSchema.parse(normalized);
    expect(parsed.metaTitle).toBe('Translated title');
    expect(parsed.metaDescription).toBe('Translated summary');
  });

  it('does not hide other missing required translation fields', () => {
    const normalized = normalizeRequiredTranslationFields({
      title: '',
      slug: 'translated-title',
      excerpt: 'Translated summary',
      body: 'Translated body',
      metaTitle: '',
      metaDescription: '',
    });

    expect(TranslationOutputSchema.safeParse(normalized).success).toBe(false);
  });
});