import 'server-only';

import { revalidatePath } from 'next/cache';
import { SUPPORTED_LANGS } from '@/lib/i18n';

export function revalidateHomepageLocale(locale: string): void {
  revalidatePath(locale === 'tr' ? '/' : `/${locale}`);
}

/**
 * Service title, excerpt, ordering, active state and homepage visibility are
 * shared by every localized homepage service grid.
 */
export function revalidateAllHomepagesForServiceChange(): void {
  revalidateHomepageLocale('tr');
  for (const locale of SUPPORTED_LANGS) {
    revalidateHomepageLocale(locale);
  }
}

/** A localized service card can change independently of the Turkish source. */
export function revalidateHomepageForServiceTranslation(locale: string): void {
  revalidateHomepageLocale(locale);
}