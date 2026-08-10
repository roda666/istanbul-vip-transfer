/**
 * Catalog-backed language lookups for the AI translation engines.
 * Replaces the old hardcoded LANG_NAMES maps — any catalog language works.
 * Server-only.
 */
import 'server-only';

export interface TranslationTargetInfo {
  code: string;
  /** English name used in the prompt, e.g. "French". */
  name: string;
  direction: 'ltr' | 'rtl';
  providerSupported: boolean;
  isEnabled: boolean;
}

/** Static fallback for the launched languages if the DB is unavailable. */
const FALLBACK: Record<string, TranslationTargetInfo> = {
  en: { code: 'en', name: 'English', direction: 'ltr', providerSupported: true, isEnabled: true },
  de: { code: 'de', name: 'German', direction: 'ltr', providerSupported: true, isEnabled: true },
  ru: { code: 'ru', name: 'Russian', direction: 'ltr', providerSupported: true, isEnabled: true },
  ar: { code: 'ar', name: 'Arabic', direction: 'rtl', providerSupported: true, isEnabled: true },
};

/**
 * Look up one or more target languages from the catalog.
 * Returns a map keyed by code; unknown codes are simply absent.
 */
export async function getTranslationTargets(
  codes: string[],
): Promise<Record<string, TranslationTargetInfo>> {
  try {
    const { db } = await import('@/db');
    const { languages } = await import('@/db/schema');
    const { inArray } = await import('drizzle-orm');
    const rows = await db
      .select({
        code: languages.code,
        name: languages.name,
        direction: languages.direction,
        providerSupported: languages.providerSupported,
        isEnabled: languages.isEnabled,
      })
      .from(languages)
      .where(inArray(languages.code, codes));
    return Object.fromEntries(rows.map((r) => [r.code, r]));
  } catch {
    return Object.fromEntries(codes.filter((c) => FALLBACK[c]).map((c) => [c, FALLBACK[c]]));
  }
}

/** Prompt-facing name for a language (with Arabic RTL hint). */
export function promptLangName(info: TranslationTargetInfo | undefined, code: string): string {
  if (!info) return code;
  return info.direction === 'rtl' ? `${info.name} (RTL script)` : info.name;
}
