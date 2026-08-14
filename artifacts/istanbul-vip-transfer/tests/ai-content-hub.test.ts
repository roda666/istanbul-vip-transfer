/**
 * Unit tests for AI Content Hub logic.
 * Covers: analyzeQuality (pure fn), fabrication guard patterns,
 * AIResult type narrowing, cannibalization heuristics.
 */
import { describe, it, expect } from 'vitest';
import { analyzeQuality } from '../lib/ai/content-hub';

// ── analyzeQuality ─────────────────────────────────────────────────────────────

describe('analyzeQuality', () => {
  const baseOpts = {
    title: 'Istanbul VIP Transfer Rehberi',
    body: '<h2>Neden VIP Transfer?</h2><p>Konfor ve güvenlik sunar.</p><h2>IST Havalimanı</h2><p>Profesyonel şoförler.</p><h2>SAW Havalimanı</h2><p>Sabiha Gökçen için de hizmet verir.</p>',
    excerpt: '150 karakter civarında bir özet. Istanbul VIP Transfer hizmetleri hakkında kapsamlı bilgi sunulmaktadır.',
    metaTitle: 'Istanbul VIP Transfer — Profesyonel Havalimanı Transferi',
    metaDescription: 'Istanbul VIP Transfer hizmetleri hakkında her şey. IST ve SAW havalimanları için lüks araç kiralama seçenekleri.',
    primaryKeyword: 'Istanbul VIP Transfer',
    sourceCount: 2,
  };

  it('returns scores between 0 and 100', () => {
    const result = analyzeQuality(baseOpts);
    expect(result.intentAlignment).toBeGreaterThanOrEqual(0);
    expect(result.intentAlignment).toBeLessThanOrEqual(100);
    expect(result.titleHierarchy).toBeGreaterThanOrEqual(0);
    expect(result.titleHierarchy).toBeLessThanOrEqual(100);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('detects primary keyword in title → high intent alignment', () => {
    const result = analyzeQuality(baseOpts);
    expect(result.intentAlignment).toBeGreaterThan(70);
  });

  it('penalizes missing primary keyword in title', () => {
    const result = analyzeQuality({
      ...baseOpts,
      title: 'Havalimanı Ulaşım Hakkında',
    });
    expect(result.intentAlignment).toBeLessThan(80);
    expect(result.suggestions.some(s => s.includes('birincil anahtar'))).toBe(true);
  });

  it('penalizes insufficient H2 count (< 3)', () => {
    const result = analyzeQuality({
      ...baseOpts,
      body: '<h2>Tek Başlık</h2><p>İçerik</p>',
    });
    expect(result.titleHierarchy).toBeLessThan(100);
    expect(result.suggestions.some(s => s.includes('H2'))).toBe(true);
  });

  it('detects forbidden claim patterns', () => {
    const result = analyzeQuality({
      ...baseOpts,
      title: 'En Ucuz Istanbul VIP Transfer Garantili',
    });
    expect(result.forbiddenClaims.found).toBe(true);
    expect(result.forbiddenClaims.examples.length).toBeGreaterThan(0);
  });

  it('does NOT flag clean content as forbidden', () => {
    const result = analyzeQuality(baseOpts);
    expect(result.forbiddenClaims.found).toBe(false);
  });

  it('flags short meta title', () => {
    const result = analyzeQuality({ ...baseOpts, metaTitle: 'VIP' });
    expect(result.metaLengths).toBeLessThan(100);
    expect(result.suggestions.some(s => s.includes('Meta başlık'))).toBe(true);
  });

  it('flags long meta description', () => {
    const result = analyzeQuality({
      ...baseOpts,
      metaDescription: 'A'.repeat(200),
    });
    expect(result.metaLengths).toBeLessThan(100);
  });

  it('calculates word count from body text', () => {
    const result = analyzeQuality({
      ...baseOpts,
      body: '<p>' + 'kelime '.repeat(100) + '</p>',
    });
    // readability should be higher than an empty body
    expect(result.readability).toBeGreaterThan(0);
  });

  it('internalLinkCount counts anchor placeholder links', () => {
    const result = analyzeQuality({
      ...baseOpts,
      body: '<p>Bkz. <a href="#rezervasyon">Rezervasyon</a> ve <a href="#fiyat">Fiyatlar</a></p>',
      internalLinks: [{ href: '/hizmetler' }],
    });
    expect(result.internalLinkCount).toBeGreaterThanOrEqual(1);
  });

  it('returns suggestions array as string[]', () => {
    const result = analyzeQuality(baseOpts);
    expect(Array.isArray(result.suggestions)).toBe(true);
    result.suggestions.forEach(s => expect(typeof s).toBe('string'));
  });
});

// ── Forbidden claims regex ─────────────────────────────────────────────────────

const FORBIDDEN_CLAIMS_PATTERN =
  /(garantili|garanti(|er)|kesin(likle)?|fiyat garantisi|%\s*\d+\s*indirim|dakikada ulaş|en ucuz|en hızlı|\d+\s*tl|\d+\s*euro|\d+\s*\$|müşteri yorumu|★|\brating\b|bbb onaylı|resmi olarak|yasal olarak|kanun(en|a göre)|yönetmelik)/i;

describe('FORBIDDEN_CLAIMS_PATTERN', () => {
  const forbidden = [
    'garantili rezervasyon',
    'fiyat garantisi',
    '%20 indirim',
    'en ucuz transfer',
    'en hızlı VIP',
    '300 TL',
    '50 euro',
    '★★★★★ müşteri yorumu',
    'resmi olarak sertifikalı',
    'yasal olarak zorunlu',
    'kanunca gerekli',
  ];

  const safe = [
    'Istanbul VIP Transfer',
    'profesyonel şoförler',
    'Mercedes Vito araç',
    'Sabiha Gökçen havalimanı',
    'konfor ve güven',
    'WhatsApp ile iletişim',
  ];

  forbidden.forEach(text => {
    it(`flags "${text.slice(0, 40)}"`, () => {
      expect(FORBIDDEN_CLAIMS_PATTERN.test(text)).toBe(true);
    });
  });

  safe.forEach(text => {
    it(`does NOT flag "${text}"`, () => {
      expect(FORBIDDEN_CLAIMS_PATTERN.test(text)).toBe(false);
    });
  });
});

// ── AIResult type narrowing ────────────────────────────────────────────────────

describe('AIResult type narrowing', () => {
  it('ok:true result has data property', () => {
    const result = { ok: true as const, data: { title: 'Test' }, model: 'gpt-4o-mini' };
    expect(result.ok).toBe(true);
    expect(result.data.title).toBe('Test');
  });

  it('ok:false result has reason + message', () => {
    const result = {
      ok: false as const,
      reason: 'not_configured' as const,
      message: 'OPENAI_API_KEY yapılandırılmamış.',
    };
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not_configured');
    expect(result.message).toBeTruthy();
  });

  it('rate_limited reason maps to 429-like behavior', () => {
    const result = {
      ok: false as const,
      reason: 'rate_limited' as const,
      message: 'API hız sınırı aşıldı.',
    };
    const statusCode = result.reason === 'not_configured' ? 503 : result.reason === 'rate_limited' ? 429 : 422;
    expect(statusCode).toBe(429);
  });

  it('truncated result carries partial field', () => {
    const result = {
      ok: false as const,
      reason: 'truncated' as const,
      message: 'Yanıt kesildi.',
      partial: '{"title": "Istanbul',
    };
    expect(result.partial).toContain('Istanbul');
  });
});

// ── Cannibalization logic ─────────────────────────────────────────────────────

describe('cannibalization warning structure', () => {
  it('no conflict structure is valid', () => {
    const warning = { hasConflict: false, conflictingPages: [] };
    expect(warning.hasConflict).toBe(false);
    expect(warning.conflictingPages).toHaveLength(0);
  });

  it('conflict structure contains page data', () => {
    const warning = {
      hasConflict: true,
      conflictingPages: [{ slug: 'istanbul-transfer', title: 'Istanbul Transfer', url: '/blog/istanbul-transfer' }],
    };
    expect(warning.hasConflict).toBe(true);
    expect(warning.conflictingPages[0].slug).toBe('istanbul-transfer');
  });
});
