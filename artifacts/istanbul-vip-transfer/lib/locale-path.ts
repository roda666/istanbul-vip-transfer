import { SUPPORTED_LANGS } from '@/lib/i18n';

/**
 * Builds a locale-prefixed internal navigation path.
 * - Turkish (tr) uses unprefixed paths: /hizmetler
 * - Other languages prepend the lang segment: /en/hizmetler
 * - Never double-prefixes
 * - Preserves query strings and hash anchors
 */
export function localePath(path: string, lang: string): string {
  // Separate path from query/hash suffix
  let suffix = '';
  let base = path;
  const hashIdx = path.indexOf('#');
  const qIdx = path.indexOf('?');
  if (hashIdx !== -1 && (qIdx === -1 || hashIdx < qIdx)) {
    suffix = path.slice(hashIdx);
    base = path.slice(0, hashIdx);
  } else if (qIdx !== -1) {
    suffix = path.slice(qIdx);
    base = path.slice(0, qIdx);
  }

  // Strip any existing lang prefix to avoid double-prefixing
  for (const l of SUPPORTED_LANGS) {
    if (base === `/${l}`) { base = '/'; break; }
    if (base.startsWith(`/${l}/`)) { base = base.slice(l.length + 1); break; }
  }
  if (!base.startsWith('/')) base = '/' + base;

  // Turkish has no prefix
  if (lang === 'tr' || !SUPPORTED_LANGS.includes(lang as typeof SUPPORTED_LANGS[number])) {
    return (base || '/') + suffix;
  }

  // Other languages get the /{lang} prefix
  const prefixed = base === '/' ? `/${lang}` : `/${lang}${base}`;
  return prefixed + suffix;
}
