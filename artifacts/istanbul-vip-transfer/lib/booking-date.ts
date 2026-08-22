/** Formats a YYYY-MM-DD service date without timezone-based calendar shifts. */

/** WhatsApp requests are read by the Turkish operations team, so dates must
 * always remain in the unambiguous DD.MM.YYYY format regardless of visitor UI
 * locale. Keeping this independent of Intl also avoids non-Latin numerals. */
export function formatServiceDate(isoDate: string, locale: string): string {
  // Kept in the public helper signature so callers do not need locale-specific
  // branching; the operations format intentionally remains locale-independent.
  void locale;
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) return isoDate;
  return `${day}.${month}.${year}`;
}