/**
 * SEO-friendly filename generation for permanently stored AI image assets.
 *
 * A bare random UUID filename (the old convention) wastes a real Google
 * Images ranking signal: the filename itself. This module derives a short,
 * descriptive, ASCII slug from the image's alt text (falling back to a
 * page/topic string when alt text is unavailable) and appends a short
 * unique suffix so two images can never collide.
 *
 * Canonical implementation — .ts scripts (generate-hero-images.ts) and app
 * routes import this directly. Plain .mjs scripts that cannot load TS
 * (service-section-image.mjs, rename-ai-images-seo.mjs) keep an inline copy
 * of the same logic — see the project convention already used for
 * recompressWebpToBudget. Keep both copies in sync if this changes.
 */
import { randomUUID } from 'node:crypto';

const TURKISH_CHAR_MAP: Record<string, string> = {
  ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g',
  ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c',
};

// Short/common words that carry no descriptive SEO value on their own.
const STOPWORDS = new Set([
  've', 'ile', 'için', 'bir', 'bu', 'şu', 'da', 'de', 'ki', 'mi', 'mı', 'mu', 'mü',
  'gibi', 'çok', 'daha', 'en', 'olan', 'olarak', 'ne', 'nin', 'nın', 'nun', 'nün',
  'the', 'a', 'an', 'of', 'and', 'in', 'on', 'to', 'for', 'with', 'is', 'are',
]);

/** Turkish-aware transliteration + slug-word split. Exported for the build-time check. */
export function slugWords(input: string): string[] {
  let s = input;
  for (const [from, to] of Object.entries(TURKISH_CHAR_MAP)) s = s.split(from).join(to);
  s = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[^a-z0-9\s-]/g, ' ');
  return s.split(/[\s-]+/).map((w) => w.trim()).filter(Boolean);
}

/** True when `name` (no extension) is nothing but a bare hex UUID — the old, non-descriptive convention. */
export function isBareUuidFilename(name: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name);
}

const MAX_WORDS = 6;

/**
 * Build a `word-word-word-<8hex>.webp` filename.
 * - `altText` is the primary source; `fallback` (e.g. page title/heading) is used
 *   only when altText yields no usable words.
 * - `sourceId`, if given, is an existing UUID whose first 8 hex chars become the
 *   unique suffix (used when renaming an existing image, so the new name stays
 *   traceable to the old one). Otherwise a fresh UUID is generated.
 */
export function buildSeoImageFilename(
  altText: string | null | undefined,
  opts?: { fallback?: string | null; sourceId?: string },
): string {
  const suffix = (opts?.sourceId ?? randomUUID()).replace(/-/g, '').slice(0, 8);
  const primary = slugWords(altText ?? '').filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  const words = primary.length > 0 ? primary : slugWords(opts?.fallback ?? '').filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  const chosen = words.slice(0, MAX_WORDS);
  const base = chosen.length > 0 ? chosen.join('-') : 'gorsel';
  return `${base}-${suffix}.webp`;
}
