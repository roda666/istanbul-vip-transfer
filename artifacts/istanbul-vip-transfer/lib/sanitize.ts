/**
 * Server-side content sanitization.
 * Strips script injection vectors before storing admin-entered content.
 * This protects against stored XSS if content is ever rendered as raw HTML.
 */

/**
 * Sanitize HTML-like content:
 * - Removes script and iframe tags
 * - Removes inline event handlers (onclick, onload, etc.)
 * - Removes javascript: protocol from href/src attributes
 * - Removes data:text/html URIs
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';

  return (
    input
      // Remove <script> blocks
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove <iframe> blocks
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      // Remove inline event handlers: onXxx="..." or onXxx='...'
      .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      // Replace javascript: hrefs
      .replace(/(\bhref\s*=\s*["'])\s*javascript:[^"']*/gi, '$1#')
      // Remove javascript: src values
      .replace(/(\bsrc\s*=\s*["'])\s*javascript:[^"']*/gi, '$1')
      // Remove data:text/html URIs (potential HTML injection)
      .replace(/(\bsrc\s*=\s*["'])\s*data:text\/html[^"']*/gi, '$1')
  );
}

/**
 * Sanitize a plain text field — strips all HTML tags.
 * Use for slug, title, meta fields where no HTML is expected.
 */
export function sanitizeText(input: string): string {
  if (!input) return '';
  return input.replace(/<[^>]*>/g, '').trim();
}

/**
 * Normalize a slug: lowercase, replace spaces/special chars with hyphens.
 */
export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
