import { describe, expect, it } from 'vitest';
import {
  localizedPathForLanguageSwitch,
  localizedPublicPath,
  localizedServicePath,
  localizedStaticPath,
  resolveLocalizedServiceSlug,
  resolveLocalizedStaticSlug,
} from '../../lib/localized-service-path';

const TARGET_LOCALES = ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'] as const;
const ISTANBUL_AIRPORT_SERVICE = 'istanbul-havalimani-transfer';
const SERVICES_PAGE = 'hizmetler';

describe('localized service paths', () => {
  it('uses a readable German service slug without Turkish source terms or IATA suffixes', () => {
    expect(localizedServicePath(ISTANBUL_AIRPORT_SERVICE, 'de'))
      .toBe('/de/istanbul-flughafen-transfer');
  });

  it.each(TARGET_LOCALES)('round-trips the localized service slug for %s', (locale) => {
    const path = localizedServicePath(ISTANBUL_AIRPORT_SERVICE, locale);
    const routeSegment = path.split('/').at(-1)!;

    expect(routeSegment).not.toBe('istanbul-havalimani-transfer');
    expect(resolveLocalizedServiceSlug(routeSegment, locale)).toBe(ISTANBUL_AIRPORT_SERVICE);
  });

  it.each(TARGET_LOCALES)('keeps legacy locale-prefixed Turkish service links resolvable for %s', (locale) => {
    expect(resolveLocalizedServiceSlug(ISTANBUL_AIRPORT_SERVICE, locale))
      .toBe(ISTANBUL_AIRPORT_SERVICE);
  });

  it('rewrites the service suffix when a visitor changes language', () => {
    expect(localizedPathForLanguageSwitch('/en/istanbul-airport-transfer', 'de'))
      .toBe('/de/istanbul-flughafen-transfer');
    expect(localizedPathForLanguageSwitch('/de/istanbul-flughafen-transfer', 'tr'))
      .toBe('/istanbul-havalimani-transfer');
  });

  it('uses readable localized static page paths', () => {
    expect(localizedStaticPath(SERVICES_PAGE, 'de')).toBe('/de/dienstleistungen');
    expect(localizedStaticPath('araclar', 'en')).toBe('/en/our-fleet');
    expect(localizedStaticPath('iletisim', 'de')).toBe('/de/kontakt');
  });

  it.each(TARGET_LOCALES)('round-trips localized static routes for %s', (locale) => {
    const path = localizedStaticPath(SERVICES_PAGE, locale);
    const routeSegment = path.split('/').at(-1)!;

    expect(routeSegment).not.toBe(SERVICES_PAGE);
    expect(resolveLocalizedStaticSlug(routeSegment, locale)).toBe(SERVICES_PAGE);
    expect(resolveLocalizedStaticSlug(SERVICES_PAGE, locale)).toBe(SERVICES_PAGE);
  });

  it('rewrites static suffixes for generic links and language switching', () => {
    expect(localizedPublicPath('/hizmetler', 'de')).toBe('/de/dienstleistungen');
    expect(localizedPathForLanguageSwitch('/de/dienstleistungen', 'en')).toBe('/en/services');
    expect(localizedPathForLanguageSwitch('/en/services', 'tr')).toBe('/hizmetler');
  });
});