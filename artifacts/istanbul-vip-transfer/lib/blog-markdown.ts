export type SafeImageSource =
  | { kind: 'optimized'; src: string }
  | { kind: 'native'; src: string }
  | null;

const OPTIMIZED_HOSTS = [
  'storage.googleapis.com',
];

function isSafeLocalPath(value: string) {
  return value.startsWith('/') && !value.startsWith('//') && !value.includes('\\');
}

/**
 * Keeps image handling aligned with next.config.ts. Do not add arbitrary hosts
 * here: Image only accepts the narrowly configured remotePatterns.
 */
export function getSafeImageSource(value: string): SafeImageSource {
  const src = value.trim();
  if (!src) return null;
  if (isSafeLocalPath(src)) return { kind: 'optimized', src };

  try {
    const url = new URL(src);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const isOptimizedHost = url.protocol === 'https:' && (
      OPTIMIZED_HOSTS.includes(url.hostname) || url.hostname.endsWith('.replit.dev')
    );
    return { kind: isOptimizedHost ? 'optimized' : 'native', src: url.toString() };
  } catch {
    return null;
  }
}

export function safeImageAlt(value: string | undefined, fallback = 'Article image') {
  const normalized = (value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/[<>]/g, '').trim();
  return (normalized || fallback).slice(0, 200);
}

export type MarkdownImage = { alt: string; src: string };

export function parseMarkdownImage(line: string): MarkdownImage | null {
  const match = line.trim().match(/^!\[([^\]]*)\]\(([^()\s]+)(?:\s+["'][^"']*["'])?\)$/);
  if (!match || !getSafeImageSource(match[2])) return null;
  return { alt: safeImageAlt(match[1]), src: match[2] };
}

export type PipeTable = { headers: string[]; rows: string[][] };

function tableCells(line: string) {
  const value = line.trim();
  if (!value.includes('|')) return null;
  const withoutEdges = value.replace(/^\|/, '').replace(/\|$/, '');
  return withoutEdges.split('|').map(cell => cell.trim());
}

function isDivider(cells: string[]) {
  return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
}

/** Parse the header and divider at startIndex, returning rows through the first non-table line. */
export function parsePipeTable(lines: string[], startIndex: number): (PipeTable & { endIndex: number }) | null {
  const headers = tableCells(lines[startIndex] ?? '');
  const divider = tableCells(lines[startIndex + 1] ?? '');
  if (!headers || !divider || headers.length !== divider.length || !isDivider(divider)) return null;

  const rows: string[][] = [];
  let endIndex = startIndex + 2;
  while (endIndex < lines.length) {
    const cells = tableCells(lines[endIndex]);
    if (!cells || cells.length !== headers.length) break;
    rows.push(cells);
    endIndex++;
  }
  return { headers, rows, endIndex };
}

export function isSafeLinkHref(value: string) {
  const href = value.trim();
  if (href.startsWith('/') && !href.startsWith('//')) return true;
  if (href.startsWith('#')) return true;
  try {
    const url = new URL(href);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
  } catch {
    return false;
  }
}