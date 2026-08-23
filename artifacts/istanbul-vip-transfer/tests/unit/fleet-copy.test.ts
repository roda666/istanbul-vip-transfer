import { describe, expect, it } from 'vitest';
import { getDictionary } from '../../lib/i18n';

const LOCALES = ['tr', 'en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'];

describe('inclusive fleet copy', () => {
  it.each(LOCALES)('describes the complete fleet in %s', (locale) => {
    const copy = getDictionary(locale).vehicles;
    expect(copy.heading.trim()).toBeTruthy();
    expect(copy.subheading.trim()).toBeTruthy();
    expect(copy.subheading.toLowerCase()).not.toMatch(/\btwo\b|iki VIP araç|zwei|dos vehículos|due veicoli|twee/);
  });

  it.each(LOCALES)('uses inclusive copy in the actual vehicles page hero for %s', (locale) => {
    const copy = getDictionary(locale).pages;
    expect(copy.vehiclesTitle.trim()).toBeTruthy();
    expect(copy.vehiclesSubtitle.trim()).toBeTruthy();
    expect(copy.vehiclesSubtitle.toLowerCase()).not.toMatch(/\btwo\b|iki VIP araç|zwei|dos vehículos|due veicoli|twee/);
  });

  it('does not present the Turkish fleet as Mercedes-only', () => {
    const copy = getDictionary('tr').vehicles;
    expect(copy.heading).not.toContain('Mercedes');
    expect(copy.subheading).toContain('Minivan');
    expect(copy.subheading).toContain('otobüs');
    expect(getDictionary('tr').pages.vehiclesTitle).not.toContain('Mercedes');
    expect(getDictionary('tr').pages.vehiclesSubtitle).toContain('midibüs');
  });
});