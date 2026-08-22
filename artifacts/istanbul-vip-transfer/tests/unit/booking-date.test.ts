import { describe, expect, it } from 'vitest';
import { formatServiceDate } from '@/lib/booking-date';

describe('formatServiceDate', () => {
  it.each(['tr', 'en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'])(
    'uses an unambiguous DD.MM.YYYY format for %s',
    (locale) => {
      expect(formatServiceDate('2026-12-05', locale)).toBe('05.12.2026');
    },
  );

  it('leaves an invalid date value untouched', () => {
    expect(formatServiceDate('not-a-date', 'tr')).toBe('not-a-date');
  });
});