import { describe, expect, it } from 'vitest';
import { validateBlogTranslation } from '@/lib/blog-atomic-publish';

const valid = {
  title: 'Translated title',
  slug: 'translated-title',
  excerpt: 'Translated excerpt',
  body: 'Translated body with [the link](/internal-link)',
  metaTitle: 'Translated title',
  metaDescription: 'Translated description',
  focusKeyword: '',
  supportingKeywords: [],
  imageAlt: '',
  imageTitle: '',
  imageCaption: '',
};

describe('automatic Blog publication safety gate', () => {
  it('rejects customer-visible toll or bridge copy before atomic publication', () => {
    const result = validateBlogTranslation({
      ...valid,
      body: 'A bridge crossing costs a toll. [The link](/internal-link)',
    }, 'Source [the link](/internal-link)');

    expect(result).toEqual({
      ok: false,
      error: 'Çeviri müşteri görünür geçiş ücreti/köprü/otoyol ifadesi içeriyor; yayın engellendi.',
    });
  });

  it('rejects output that drops a source internal link', () => {
    const result = validateBlogTranslation({
      ...valid,
      body: 'Translated body without the source link',
    }, 'Source [the link](/internal-link)');

    expect(result).toEqual({
      ok: false,
      error: 'Çeviri zorunlu dahili bağlantıyı korumadı: /internal-link',
    });
  });

  it('accepts grounded output with all source links preserved', () => {
    expect(validateBlogTranslation(valid, 'Source [the link](/internal-link)')).toMatchObject({ ok: true });
  });
});