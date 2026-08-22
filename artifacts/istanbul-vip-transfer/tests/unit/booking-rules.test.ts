import { describe, expect, it } from 'vitest';
import { formatServiceDate } from '../../lib/booking-date';
import {
  isFiveMinuteIncrement,
  isValidPassengerCount,
  meetsAllocationMinimum,
} from '../../lib/booking-rules';

describe('booking date formatting', () => {
  it('keeps the WhatsApp date in DD.MM.YYYY', () => {
    expect(formatServiceDate('2026-08-21', 'tr')).toBe('21.08.2026');
  });

  it('keeps the operational format independent of the visitor locale', () => {
    expect(formatServiceDate('2026-08-21', 'en')).toBe('21.08.2026');
    expect(formatServiceDate('2026-08-21', 'de')).toBe('21.08.2026');
  });
});

describe('booking constraints', () => {
  it('accepts only 1–30 passengers', () => {
    expect(isValidPassengerCount(1)).toBe(true);
    expect(isValidPassengerCount(30)).toBe(true);
    expect(isValidPassengerCount(31)).toBe(false);
    expect(isValidPassengerCount(0)).toBe(false);
  });

  it('accepts only five-minute time increments', () => {
    expect(isFiveMinuteIncrement('00')).toBe(true);
    expect(isFiveMinuteIncrement('55')).toBe(true);
    expect(isFiveMinuteIncrement('07')).toBe(false);
  });

  it('requires at least four hours for vehicle allocation', () => {
    expect(meetsAllocationMinimum(4, 'SAAT')).toBe(true);
    expect(meetsAllocationMinimum(3, 'SAAT')).toBe(false);
    expect(meetsAllocationMinimum(1, 'GUN')).toBe(true);
  });
});