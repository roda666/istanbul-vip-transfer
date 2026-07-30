/**
 * Human-readable Turkish labels for booking source values.
 * DB source values are never modified — only the display changes.
 */

export const SOURCE_LABELS: Record<string, string> = {
  'booking-form:AIRPORT_TRANSFER': 'Rezervasyon Formu – Havalimanı / Şehir İçi Transfer',
  'booking-form:INTERCITY':        'Rezervasyon Formu – Şehirler Arası Transfer',
  'booking-form:ALLOCATION':       'Rezervasyon Formu – Araç Tahsisi',
  'booking-form:TOUR':             'Rezervasyon Formu – Özel Tur / Gezi',
  'booking-form':                  'Rezervasyon Formu',
};

/** Options for the source filter dropdown (value = raw DB value, label = readable Turkish). */
export const SOURCE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'booking-form:AIRPORT_TRANSFER', label: 'Rezervasyon Formu – Havalimanı / Şehir İçi Transfer' },
  { value: 'booking-form:INTERCITY',        label: 'Rezervasyon Formu – Şehirler Arası Transfer' },
  { value: 'booking-form:ALLOCATION',       label: 'Rezervasyon Formu – Araç Tahsisi' },
  { value: 'booking-form:TOUR',             label: 'Rezervasyon Formu – Özel Tur / Gezi' },
];

/** Returns the human-readable Turkish label for a source value, or the raw value if unmapped. */
export function formatSource(source: string | null | undefined): string {
  if (!source) return '—';
  return SOURCE_LABELS[source] ?? source;
}
