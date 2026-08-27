/**
 * Returns the Europe/Istanbul calendar date (YYYY-MM-DD) for a given instant,
 * optionally offset by a whole number of days.
 *
 * This is built entirely from calendar parts (via Intl.DateTimeFormat) and
 * arithmetic on a UTC-midnight marker for that calendar date — it never
 * constructs a real Istanbul instant (e.g. "...T00:00:00+03:00") and reads
 * it back through `toISOString()`. Doing that round-trips through UTC and
 * silently shifts the reported date backward by one day, since Istanbul is
 * UTC+3: local midnight is 21:00 UTC the day before, every single day, not
 * just near a midnight edge case.
 */
export function getIstanbulCalendarDate(offsetDays = 0, referenceDate: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(referenceDate);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  // Date.UTC with the Istanbul calendar parts (not the real UTC instant)
  // gives us a stable "calendar-date" marker: adding/subtracting whole days
  // and reading the date back out with toISOString() never crosses a
  // timezone boundary, because no timezone offset was ever mixed in.
  const calendarDate = new Date(Date.UTC(value('year'), value('month') - 1, value('day')));
  calendarDate.setUTCDate(calendarDate.getUTCDate() + offsetDays);
  return calendarDate.toISOString().slice(0, 10);
}
