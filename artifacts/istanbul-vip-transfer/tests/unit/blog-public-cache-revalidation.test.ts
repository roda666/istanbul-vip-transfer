import { describe, expect, it, vi } from 'vitest';

const { revalidatePath, revalidateTag } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath,
  revalidateTag,
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

import { revalidatePublicBlogPaths } from '@/lib/blog-cms';

describe('public blog cache invalidation', () => {
  it('invalidates cards, old and new detail URLs, localized listings, and sitemap', async () => {
    revalidatePublicBlogPaths({
      id: 'post-id',
      slug: 'new-slug',
      previousSlug: 'old-slug',
      previousLocalizedSlugs: [{ locale: 'en', slug: 'old-english-slug' }],
    });

    expect(revalidateTag).toHaveBeenCalledWith('public-blog');
    expect(revalidatePath).toHaveBeenCalledWith('/blog');
    expect(revalidatePath).toHaveBeenCalledWith('/blog/new-slug');
    expect(revalidatePath).toHaveBeenCalledWith('/blog/old-slug');
    expect(revalidatePath).toHaveBeenCalledWith('/en/blog');
    expect(revalidatePath).toHaveBeenCalledWith('/en/blog/old-english-slug');
    expect(revalidatePath).toHaveBeenCalledWith('/sitemap.xml');
  });
});