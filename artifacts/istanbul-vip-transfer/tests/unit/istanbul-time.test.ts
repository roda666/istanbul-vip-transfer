import { describe, expect, it } from 'vitest';
import { getIstanbulCalendarDate } from '@/lib/istanbul-time';

describe('getIstanbulCalendarDate', () => {
  it('returns the correct Istanbul calendar date for a plain daytime UTC instant', () => {
    // 2026-08-27T10:00:00Z = 2026-08-27 13:00 in Istanbul (UTC+3).
    expect(getIstanbulCalendarDate(0, new Date('2026-08-27T10:00:00Z'))).toBe('2026-08-27');
  });

  it('does not shift the date back by one day just after Istanbul midnight', () => {
    // 2026-08-26T21:05:00Z = 2026-08-27 00:05 in Istanbul — just past local
    // midnight. The old buggy implementation reported this as 2026-08-26
    // (the previous day) for every single call, not just near midnight.
    expect(getIstanbulCalendarDate(0, new Date('2026-08-26T21:05:00Z'))).toBe('2026-08-27');
  });

  it('does not roll forward a day just before Istanbul midnight', () => {
    // 2026-08-26T20:55:00Z = 2026-08-26 23:55 in Istanbul — five minutes
    // before local midnight.
    expect(getIstanbulCalendarDate(0, new Date('2026-08-26T20:55:00Z'))).toBe('2026-08-26');
  });

  it('is correct at the exact instant of Istanbul local midnight', () => {
    // 2026-08-26T21:00:00Z = 2026-08-27 00:00:00 in Istanbul exactly.
    expect(getIstanbulCalendarDate(0, new Date('2026-08-26T21:00:00Z'))).toBe('2026-08-27');
  });

  it('computes "tomorrow" correctly across the Istanbul midnight boundary', () => {
    // Istanbul 2026-08-27 23:59 — "tomorrow" must be 2026-08-28, not 2026-08-27.
    expect(getIstanbulCalendarDate(1, new Date('2026-08-27T20:59:00Z'))).toBe('2026-08-28');
  });

  it('computes "tomorrow" correctly across a month boundary', () => {
    // Istanbul 2026-08-31 23:30 — "tomorrow" must roll into September.
    expect(getIstanbulCalendarDate(1, new Date('2026-08-31T20:30:00Z'))).toBe('2026-09-01');
  });

  it('computes "tomorrow" correctly across a year boundary', () => {
    // Istanbul 2026-12-31 23:30 — "tomorrow" must roll into the next year.
    expect(getIstanbulCalendarDate(1, new Date('2026-12-31T20:30:00Z'))).toBe('2027-01-01');
  });

  it('handles a negative offset ("yesterday") across a midnight boundary', () => {
    // Istanbul 2026-08-27 00:10 — "yesterday" must be 2026-08-26.
    expect(getIstanbulCalendarDate(-1, new Date('2026-08-26T21:10:00Z'))).toBe('2026-08-26');
  });

  it('defaults to the current instant when no reference date is given', () => {
    const result = getIstanbulCalendarDate();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
