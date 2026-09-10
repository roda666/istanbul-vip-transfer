import { describe, expect, it } from 'vitest';
import { findExactFastQuoteRoute, sortFastQuoteTollAlternatives } from '@/lib/admin-fast-quote';

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