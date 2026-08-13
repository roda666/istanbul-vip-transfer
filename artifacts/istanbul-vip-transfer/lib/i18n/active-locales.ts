/**
 * Single source of truth for the publicly visible locale set.
 *
 * A language is PUBLIC when it is both enabled AND published in the languages
 * table AND has a static UI dictionary (RENDERABLE_LOCALES).  The 4 new
 * languages es/fr/it/nl are enabled in the DB but isPublished=false until
 * their UI dictionaries ship (task "Complete UI dictionaries for es/fr/it/nl").
 *
 * Server-only — uses the database with a short in-memory cache and a static
 * fallback so public pages never break if the DB is unavailable.
 */
import 'server-only';
import { RENDERABLE_LOCALES } from './locale-registry';

/**
 * Languages the public site can actually RENDER (static UI dictionaries exist).
 * A language outside this set must never go public, whatever the DB says —
 * publishing it would produce broken pages.
 * Source: locale-registry.ts RENDERABLE_LOCALES — not duplicated here.
 */
export const RENDERABLE_LANGS: readonly string[] = RENDERABLE_LOCALES;

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
    // Defense in depth: only renderable languages (with UI dictionaries) may
    // ever be exposed publicly, regardless of DB state.
    const renderable = rows.filter((r) => (RENDERABLE_LANGS as string[]).includes(r.code));
    if (renderable.length === 0) return FALLBACK_PUBLIC_LANGUAGES;
    // Turkish must always be present, whatever the DB says.
    const langs = renderable.some((r) => r.code === 'tr')
      ? renderable
      : [FALLBACK_PUBLIC_LANGUAGES[0], ...renderable];
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

/** Invalidate the cache (call after admin changes language state). */
export function invalidatePublicLanguagesCache(): void {
  cache = null;
}
