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
    }, 'Source [the link](/internal-link)', 'en');

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: expect.stringContaining('geçiş ücreti') });
  });

  it('rejects output that drops a source internal link', () => {
    const result = validateBlogTranslation({
      ...valid,
      body: 'Translated body without the source link',
    }, 'Source [the link](/internal-link)', 'en');

    expect(result).toEqual({
      ok: false,
      error: 'Çeviri zorunlu dahili bağlantıyı korumadı: /internal-link',
    });
  });

  it('accepts grounded output with all source links preserved', () => {
    expect(validateBlogTranslation(valid, 'Source [the link](/internal-link)', 'en')).toMatchObject({ ok: true });
  });

  it.each([
    ['en', 'Ankara has a bridge and highway route context.'],
    ['de', 'Die Brücke und Autobahn werden nur als Route erwähnt.'],
    ['ru', 'Маршрут проходит возле моста и автомагистрали.'],
    ['fr', 'Le pont et l’autoroute sont seulement des repères.'],
    ['es', 'La ruta pasa junto al puente y la autopista.'],
    ['it', 'Il ponte e l’autostrada sono indicazioni geografiche.'],
    ['nl', 'De route loopt langs de brug en snelweg.'],
    ['ar', 'يمر المسار قرب الجسر والطريق السريع.'],
  ])('allows geography-only route context in %s', (locale, body) => {
    expect(validateBlogTranslation({ ...valid, body: `${body} [link](/internal-link)` },
      'Source [link](/internal-link)', locale)).toMatchObject({ ok: true });
  });

  it.each([
    ['de', 'Die Brücke kostet eine Gebühr.'],
    ['ru', 'За мост взимается плата за проезд.'],
    ['fr', 'Le pont a un péage.'],
    ['es', 'El puente tiene un peaje.'],
    ['it', 'Il ponte richiede un pedaggio.'],
    ['nl', 'De brug heeft tol.'],
    ['ar', 'توجد رسوم عبور عند الجسر.'],
  ])('rejects locale-scoped direct or geo+fee wording in %s', (locale, body) => {
    const result = validateBlogTranslation({ ...valid, body: `${body} [link](/internal-link)` },
      'Source [link](/internal-link)', locale);
    expect(result.ok).toBe(false);
  });
});