/**
 * Single source of truth for the publicly visible locale set.
 *
 * A language is PUBLIC when it is both enabled AND published in the languages
 * table. Static dictionaries remain preferred for the core locales; a newly
 * published catalog language safely uses the English UI baseline until a
 * dedicated dictionary is supplied, while its CMS content remains target-locale
 * content.
 *
 * Server-only — uses the database with a short in-memory cache and a static
 * fallback so public pages never break if the DB is unavailable.
 */
import 'server-only';
export interface PublicLanguage {
  code: string;
  locale: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  isDefault: boolean;
}

/**
 * Static fallback — mirrors all 9 renderable (dictionary-backed) languages.
 * Derived from the registry so adding a new locale to locale-registry.ts is the only change needed.
 */
import { LOCALE_REGISTRY as _REG } from './locale-registry';
export const FALLBACK_PUBLIC_LANGUAGES: PublicLanguage[] = _REG.map((l) => ({
  code:       l.code,
  locale:     l.locale,
  nativeName: l.nativeName,
  direction:  l.dir,
  isDefault:  l.isSource,
}));

const CACHE_TTL_MS = 60_000;
let cache: { at: number; langs: PublicLanguage[] } | null = null;

/** Active + published languages, ordered by displayOrder. Cached ~60s. */
export async function getPublicLanguages(): Promise<PublicLanguage[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.langs;
  try {
    const { db } = await import('@/db');
    const { languages } = await import('@/db/schema');
    const { and, eq, asc } = await import('drizzle-orm');
    const rows = await db
      .select({
        code: languages.code,
        locale: languages.locale,
        nativeName: languages.nativeName,
        direction: languages.direction,
        isDefault: languages.isDefault,
      })
      .from(languages)
      .where(and(eq(languages.isEnabled, true), eq(languages.isPublished, true)))
      .orderBy(asc(languages.displayOrder));
    if (rows.length === 0) return FALLBACK_PUBLIC_LANGUAGES;
    // Turkish must always be present, whatever the DB says.
    const langs = rows.some((r) => r.code === 'tr')
      ? rows
      : [FALLBACK_PUBLIC_LANGUAGES[0], ...rows];
    cache = { at: Date.now(), langs };
    return langs;
  } catch {
    return FALLBACK_PUBLIC_LANGUAGES;
  }
}

/** Public lang codes (tr first). */
export async function getPublicLangCodes(): Promise<string[]> {
  const langs = await getPublicLanguages();
  return langs.map((l) => l.code);
}

/** True if `code` is a publicly visible locale. */
export async function isPublicLang(code: string): Promise<boolean> {
  return (await getPublicLangCodes()).includes(code);
}

/** Returns the public catalog record for a locale, if it is currently visible. */
export async function getPublicLanguage(code: string): Promise<PublicLanguage | null> {
  return (await getPublicLanguages()).find((language) => language.code === code) ?? null;
}

/** Invalidate the cache (call after admin changes language state). */
export function invalidatePublicLanguagesCache(): void {
  cache = null;
}
