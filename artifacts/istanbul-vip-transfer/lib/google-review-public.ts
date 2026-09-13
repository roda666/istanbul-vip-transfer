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