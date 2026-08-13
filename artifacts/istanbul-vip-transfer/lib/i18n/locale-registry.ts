/**
 * Single source of truth for the 9 supported locales.
 *
 * No 'server-only' directive — also imported by middleware (Edge Runtime)
 * and client-side code. Keep this file free of Node.js / server-only APIs.
 *
 * Consumer hierarchy:
 *   locale-registry.ts  ← the ONLY place the 9 locales are listed
 *     └─ lib/i18n/index.ts          (dictionary loader, type aliases)
 *     └─ lib/i18n/active-locales.ts (DB-driven public language set)
 *     └─ middleware.ts              (prefix recognition + cookie logic)
 *     └─ lib/i18n/seo.ts            (hreflang / OG helpers)
 *     └─ all admin API routes       (fallback allowlists)
 */

export interface LocaleEntry {
  code: string;
  nativeName: string;
  englishName: string;
  dir: 'ltr' | 'rtl';
  /** BCP 47 tag used for hreflang and Open Graph alternates. */
  locale: string;
  isSource: boolean;
  /** Flag emoji for display in admin UI labels. */
  flagEmoji: string;
}

export const LOCALE_REGISTRY: readonly LocaleEntry[] = [
  { code: 'tr', nativeName: 'Türkçe',     englishName: 'Turkish',     dir: 'ltr', locale: 'tr-TR', isSource: true,  flagEmoji: '🇹🇷' },
  { code: 'en', nativeName: 'English',    englishName: 'English',     dir: 'ltr', locale: 'en-GB', isSource: false, flagEmoji: '🇬🇧' },
  { code: 'de', nativeName: 'Deutsch',    englishName: 'German',      dir: 'ltr', locale: 'de-DE', isSource: false, flagEmoji: '🇩🇪' },
  { code: 'ru', nativeName: 'Русский',    englishName: 'Russian',     dir: 'ltr', locale: 'ru-RU', isSource: false, flagEmoji: '🇷🇺' },
  { code: 'ar', nativeName: 'العربية',    englishName: 'Arabic',      dir: 'rtl', locale: 'ar-SA', isSource: false, flagEmoji: '🇸🇦' },
  { code: 'es', nativeName: 'Español',    englishName: 'Spanish',     dir: 'ltr', locale: 'es-ES', isSource: false, flagEmoji: '🇪🇸' },
  { code: 'fr', nativeName: 'Français',   englishName: 'French',      dir: 'ltr', locale: 'fr-FR', isSource: false, flagEmoji: '🇫🇷' },
  { code: 'it', nativeName: 'Italiano',   englishName: 'Italian',     dir: 'ltr', locale: 'it-IT', isSource: false, flagEmoji: '🇮🇹' },
  { code: 'nl', nativeName: 'Nederlands', englishName: 'Dutch',       dir: 'ltr', locale: 'nl-NL', isSource: false, flagEmoji: '🇳🇱' },
] as const;

// ── Derived constants ────────────────────────────────────────────────────────

/** The source / default locale code. Turkish is always prefix-free at root. */
export const SOURCE_LOCALE = 'tr' as const;

/**
 * All 8 non-source locale codes.
 * Includes es / fr / it / nl even before their UI dictionaries are ready.
 */
export const NON_SOURCE_LOCALES: readonly string[] = LOCALE_REGISTRY
  .filter((l) => !l.isSource)
  .map((l) => l.code);

/**
 * Locale codes that have complete static UI dictionaries and can serve public pages.
 * Expanded by task "Complete UI dictionaries for Spanish, French, Italian, Dutch".
 */
export const RENDERABLE_LOCALES: readonly string[] = ['tr', 'en', 'de', 'ru', 'ar'];

/** Locale codes with RTL text direction. */
export const RTL_LOCALES: readonly string[] = LOCALE_REGISTRY
  .filter((l) => l.dir === 'rtl')
  .map((l) => l.code);

/** Map from locale code → BCP 47 locale string. */
export const LOCALE_BCP47: Readonly<Record<string, string>> = Object.fromEntries(
  LOCALE_REGISTRY.map((l) => [l.code, l.locale]),
);

/** Map from locale code → native name. */
export const LOCALE_NATIVE_NAMES: Readonly<Record<string, string>> = Object.fromEntries(
  LOCALE_REGISTRY.map((l) => [l.code, l.nativeName]),
);

/** Map from locale code → flag emoji (for admin UI labels). */
export const LOCALE_FLAG_EMOJIS: Readonly<Record<string, string>> = Object.fromEntries(
  LOCALE_REGISTRY.map((l) => [l.code, l.flagEmoji]),
);

/**
 * All locale codes as a runtime tuple — use for Zod enum validation.
 * Automatically stays in sync with the registry; add/remove locales here only.
 */
export const ALL_LOCALE_CODES: [string, ...string[]] = LOCALE_REGISTRY.map((l) => l.code) as [string, ...string[]];

// ── Helper functions ─────────────────────────────────────────────────────────

/** Look up a registry entry by code. Returns undefined for unknown codes. */
export function getLocaleEntry(code: string): LocaleEntry | undefined {
  return LOCALE_REGISTRY.find((l) => l.code === code);
}

/** True if `code` is one of the 9 supported locale codes. */
export function isRegistryLocale(code: string): boolean {
  return LOCALE_REGISTRY.some((l) => l.code === code);
}

/** True if `code` is a non-source locale code recognised by the registry. */
export function isNonSourceLocale(code: string): boolean {
  return NON_SOURCE_LOCALES.includes(code);
}

/**
 * True if `code` is currently renderable (has a static UI dictionary).
 * Use this to gate public route access; do NOT use for middleware prefix detection.
 */
export function isRenderableLocale(code: string): boolean {
  return RENDERABLE_LOCALES.includes(code);
}
