import { describe, expect, it } from 'vitest';
import { resolveHomepageCtaAction } from '../../lib/homepage-cta-route';

describe('homepage CMS CTA routes', () => {
  it('localizes a configured internal page route instead of falling back to booking', () => {
    expect(resolveHomepageCtaAction('/hizmetler', 'en'))
      .toEqual({ kind: 'navigate', href: '/en/services' });
  });

  it('preserves hash scroll targets and rejects unsafe route values', () => {
    expect(resolveHomepageCtaAction('#rezervasyon', 'tr'))
      .toEqual({ kind: 'hash', target: '#rezervasyon' });
    expect(resolveHomepageCtaAction('javascript:alert(1)', 'tr'))
      .toEqual({ kind: 'hash', target: '#rezervasyon' });
    expect(resolveHomepageCtaAction('/\\evil.example', 'tr'))
      .toEqual({ kind: 'hash', target: '#rezervasyon' });
  });
});