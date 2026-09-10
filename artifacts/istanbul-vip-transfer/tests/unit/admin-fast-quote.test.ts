import { describe, expect, it } from 'vitest';
import {
  findExactFastQuoteRoute,
  findNearestFastQuoteLocation,
  resolveEffectiveFastQuoteRoute,
  sortFastQuoteTollAlternatives,
} from '@/lib/admin-fast-quote';

describe('fast quote route matching', () => {
  const routes = [
    { id: 'active-forward', originLocationId: 'istanbul', destinationLocationId: 'antalya', active: true },
    { id: 'inactive', originLocationId: 'istanbul', destinationLocationId: 'bursa', active: false },
  ];

  it('matches only an active route in the exact tariff direction', () => {
    expect(findExactFastQuoteRoute(routes, 'istanbul', 'antalya')).toBe('active-forward');
    expect(findExactFastQuoteRoute(routes, 'antalya', 'istanbul')).toBeNull();
    expect(findExactFastQuoteRoute(routes, 'istanbul', 'bursa')).toBeNull();
  });

  it('activates an exact endpoint route while the saved-route select remains empty', () => {
    const sawToTaksim = {
      id: 'saw-taksim',
      originLocationId: 'saw',
      destinationLocationId: 'taksim',
      active: true,
    };
    expect(resolveEffectiveFastQuoteRoute('', [sawToTaksim], 'saw', 'taksim')).toBe('saw-taksim');
    expect(resolveEffectiveFastQuoteRoute('', [sawToTaksim], 'ist', 'saw')).toBeNull();
    expect(resolveEffectiveFastQuoteRoute('manual-route', [sawToTaksim], 'saw', 'taksim')).toBe('manual-route');
  });
});

describe('fast quote map location matching', () => {
  const locations = [
    { id: 'airport', latitude: 41.2753, longitude: 28.7519 },
    { id: 'taksim', latitude: 41.0369, longitude: 28.9850 },
  ];

  it('matches a nearby map pin but never invents a distant catalogue location', () => {
    expect(findNearestFastQuoteLocation(locations, { latitude: 41.274, longitude: 28.754 })).toBe('airport');
    expect(findNearestFastQuoteLocation(locations, { latitude: 40.2, longitude: 29.1 })).toBeNull();
  });
});

describe('fast quote toll alternative ordering', () => {
  it('puts the default first, then preserves display order for every other option', () => {
    const sorted = sortFastQuoteTollAlternatives([
      { id: 'review-2', name: 'Review 2', isDefault: false, displayOrder: 2, needsReview: true },
      { id: 'default', name: 'Default', isDefault: true, displayOrder: 50, needsReview: false },
      { id: 'review-1', name: 'Review 1', isDefault: false, displayOrder: 1, needsReview: true },
    ]);
    expect(sorted.map((alternative) => alternative.id)).toEqual(['default', 'review-1', 'review-2']);
  });
});