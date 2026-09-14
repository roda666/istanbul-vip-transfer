/**
 * Small, client-safe helpers shared by the public Google review cards and
 * their focused contract tests. No provider or database logic belongs here.
 */
export function isConfiguredGoogleReviewUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export type PublicReviewSource = 'google_business' | 'manual';

export interface HomepageReviewDedupeCandidate {
  externalReviewId: string | null;
  source: PublicReviewSource;
  name: string;
  text: string;
}

function normalizedReviewPart(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('und');
}

/**
 * Google may later synchronize a manually approved review that is already
 * public. Prefer the provider-backed row while keeping one card.
 */
export function deduplicateHomepageReviews<T extends HomepageReviewDedupeCandidate>(rows: T[]): T[] {
  const selected: T[] = [];
  const externalIndexes = new Map<string, number>();
  const contentIndexes = new Map<string, number>();

  for (const row of rows) {
    const externalKey = row.externalReviewId?.trim() || null;
    const contentKey = `${normalizedReviewPart(row.name)}|${normalizedReviewPart(row.text)}`;
    const existingIndex = (externalKey ? externalIndexes.get(externalKey) : undefined)
      ?? contentIndexes.get(contentKey);

    if (existingIndex === undefined) {
      const index = selected.push(row) - 1;
      if (externalKey) externalIndexes.set(externalKey, index);
      contentIndexes.set(contentKey, index);
      continue;
    }

    const existing = selected[existingIndex];
    if (existing.source === 'manual' && row.source === 'google_business') {
      selected[existingIndex] = row;
      if (externalKey) externalIndexes.set(externalKey, existingIndex);
      contentIndexes.set(contentKey, existingIndex);
    }
  }

  return selected;
}

const CUSTOMER_REVIEW_LABELS: Record<string, string> = {
  tr: 'Müşteri Yorumları',
  en: 'Customer Reviews',
  de: 'Kundenbewertungen',
  ru: 'Отзывы клиентов',
  ar: 'آراء العملاء',
  fr: 'Avis clients',
  es: 'Opiniones de clientes',
  it: 'Recensioni dei clienti',
  nl: 'Klantbeoordelingen',
};

export function getCustomerReviewsLabel(locale: string): string {
  return CUSTOMER_REVIEW_LABELS[locale] ?? CUSTOMER_REVIEW_LABELS.en;
}

export function formatHomepageReviewDate(
  value: string | null | undefined,
  locale: string,
): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}