import { isLocaleCodeSyntax } from '@/lib/i18n/locale-registry';

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
  const firstSegment = base.split('/')[1] ?? '';
  if (firstSegment !== 'tr' && isLocaleCodeSyntax(firstSegment)) {
    if (base === `/${firstSegment}`) base = '/';
    else if (base.startsWith(`/${firstSegment}/`)) base = base.slice(firstSegment.length + 1);
  }
  if (!base.startsWith('/')) base = '/' + base;

  // Turkish has no prefix
  if (lang === 'tr' || !isLocaleCodeSyntax(lang)) {
    return (base || '/') + suffix;
  }

  // Other languages get the /{lang} prefix
  const prefixed = base === '/' ? `/${lang}` : `/${lang}${base}`;
  return prefixed + suffix;
}
