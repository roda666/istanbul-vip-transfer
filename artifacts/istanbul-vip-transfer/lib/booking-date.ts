/** Formats a YYYY-MM-DD service date without timezone-based calendar shifts. */

const DATE_LOCALES: Record<string, string> = {
  en: 'en-GB',
  de: 'de-DE',
  ru: 'ru-RU',
  ar: 'ar-SA',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  nl: 'nl-NL',
};

export function formatServiceDate(isoDate: string, locale: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  if (locale === 'tr') return `${day}/${month}/${year}`;

  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return isoDate;

  return new Intl.DateTimeFormat(DATE_LOCALES[locale] ?? 'en-GB', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}