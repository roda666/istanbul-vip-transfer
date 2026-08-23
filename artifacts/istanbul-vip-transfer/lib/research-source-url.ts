/**
 * Client-safe boundary for persisted research-source URLs. Database rows can
 * predate generation sanitization, so renderers must validate independently.
 */
export function safeResearchSourceHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  // Require an explicit HTTP scheme; URL() alone would normalize some
  // surprising values and protocol-relative URLs must never become anchors.
  if (!/^https?:\/\//i.test(raw)) return null;
  try {
    const parsed = new URL(raw);
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}