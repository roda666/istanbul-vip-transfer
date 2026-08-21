/**
 * Helpers for mixed Arabic/Latin text on public pages.
 *
 * Unicode LTR isolates preserve the visual order of technical identifiers in
 * Arabic text without changing their value for copy, search, or screen readers.
 */

export function getContentDirection(locale: string): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

const LTR_VALUE_PATTERN =
  /(?:Mercedes\s+(?:Vito|Sprinter(?:\s+VIP)?)|VW\s+Transporter|\b(?:IST|SAW)\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d\s()\-./:]{6,}\d)/giu;

export function isolateLtrValues(value: string, locale: string): string {
  if (getContentDirection(locale) !== 'rtl') return value;
  return value.replace(LTR_VALUE_PATTERN, (token) => `\u2066${token}\u2069`);
}