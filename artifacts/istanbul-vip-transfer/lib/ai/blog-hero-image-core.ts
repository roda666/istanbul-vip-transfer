export type BlogHeroImageBrief = {
  prompt: string;
  altText: string;
  enabled?: boolean;
  placement?: 'hero' | 'body';
  targetSlug?: string;
  insertAfterHeading?: string;
};

export type BlogHeroConfigResult =
  | { kind: 'valid'; config: BlogHeroImageBrief }
  | { kind: 'disabled'; reason: string }
  | { kind: 'invalid'; reason: string };

const allowedKeys = new Set([
  'prompt',
  'altText',
  'enabled',
  'placement',
  'targetSlug',
  'insertAfterHeading',
]);

/** Strictly validate one user-authored blog image brief; intentionally no fallback exists. */
export function validateBlogHeroImageBrief(value: unknown): BlogHeroConfigResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { kind: 'invalid', reason: 'entry must be an object with prompt and altText' };
  }
  const entry = value as Record<string, unknown>;
  const unexpected = Object.keys(entry).find(key => !allowedKeys.has(key));
  if (unexpected) return { kind: 'invalid', reason: `entry has unsupported field "${unexpected}"` };
  if (typeof entry.enabled !== 'undefined' && typeof entry.enabled !== 'boolean') {
    return { kind: 'invalid', reason: 'enabled must be a boolean when supplied' };
  }
  if (entry.enabled === false) return { kind: 'disabled', reason: 'configuration is disabled' };
  if (typeof entry.prompt !== 'string' || !entry.prompt.trim()) {
    return { kind: 'invalid', reason: 'prompt must be a nonblank string (no prompt fallback is used)' };
  }
  if (typeof entry.altText !== 'string' || !entry.altText.trim()) {
    return { kind: 'invalid', reason: 'altText must be a nonblank string' };
  }
  const placement = entry.placement ?? 'hero';
  if (placement !== 'hero' && placement !== 'body') {
    return { kind: 'invalid', reason: 'placement must be hero or body' };
  }
  const targetSlug = typeof entry.targetSlug === 'string' ? entry.targetSlug.trim() : undefined;
  const insertAfterHeading = typeof entry.insertAfterHeading === 'string'
    ? entry.insertAfterHeading.trim()
    : undefined;
  if (placement === 'body' && !targetSlug) {
    return { kind: 'invalid', reason: 'body placement requires a nonblank targetSlug' };
  }
  if (placement === 'body' && !insertAfterHeading) {
    return { kind: 'invalid', reason: 'body placement requires a nonblank insertAfterHeading' };
  }
  return {
    kind: 'valid',
    config: {
      prompt: entry.prompt.trim(),
      altText: entry.altText.trim(),
      enabled: entry.enabled,
      placement,
      targetSlug,
      insertAfterHeading,
    },
  };
}

export function validateBlogHeroImageConfig(value: unknown): Map<string, BlogHeroConfigResult> | string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'configuration root must be an object keyed by blog slug';
  const result = new Map<string, BlogHeroConfigResult>();
  for (const [slug, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!slug.trim()) {
      result.set(slug, { kind: 'invalid', reason: 'slug key must not be blank' });
    } else {
      result.set(slug, validateBlogHeroImageBrief(entry));
    }
  }
  return result;
}

export const BLOG_HERO_PLACEHOLDERS = new Set([
  '/images/istanbul-vip-transfer-hero.webp',
  '/images/blog/istanbul-havalimani-transfer-rehberi.jpg',
  '/images/blog/sabiha-gokcen-transfer-rehberi.jpg',
  '/images/blog/vip-transfer-ile-taksi-arasindaki-farklar.jpg',
]);

export function isBlogHeroEligible(heroImage: string | null, heroImageAlt: string | null): boolean {
  return !heroImage?.trim() || BLOG_HERO_PLACEHOLDERS.has(heroImage.trim()) || !heroImageAlt?.trim();
}

export function blogHeroObjectName(slug: string, id: string): string {
  return `ai-images/blog/${slug}/${id}.webp`;
}

/** Batch runner gate: dry-runs may select records but must never generate or write. */
export function mayGenerateAndWrite(dryRun: boolean): boolean {
  return !dryRun;
}