import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeBlogAtomicSourceHash } from '@/lib/blog-atomic-publish';

const root = resolve(__dirname, '../..');
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('G5 blog author visibility contract', () => {
  it('adds a default-true database field in the next migration and admin record', () => {
    expect(read('db/schema.ts')).toMatch(/showAuthor:\s*boolean\('show_author'\)\.default\(true\)\.notNull\(\)/);
    expect(read('drizzle/migrations/0112_blog_author_visibility.sql'))
      .toContain('boolean NOT NULL DEFAULT true');
    expect(read('drizzle/migrations/meta/_journal.json'))
      .toMatch(/"idx": 112[\s\S]*"tag": "0112_blog_author_visibility"/);
    expect(read('lib/blog-cms.ts')).toMatch(/showAuthor:\s*boolean;/);
  });

  it('persists false from PUT and includes checkbox-only changes in atomic source data', () => {
    const route = read('app/admin/api/blog/[id]/route.ts');
    expect(route).toMatch(/showAuthor:\s*z\.boolean\(\)\.optional\(\)/);
    expect(route).toMatch(/const showAuthor = data\.showAuthor \?\? row\.showAuthor \?\? true/);
    expect(route).toMatch(/showAuthor !== row\.showAuthor/);
    expect(route).toMatch(/showAuthor,\s*\n\s*tags:/);
    expect(route).toMatch(/showAuthor: row\.showAuthor/);
  });

  it('changes the atomic source hash when only author visibility changes', () => {
    const base = {
      title: 'Title', slug: 'title', excerpt: null, body: 'Body',
      seoTitle: null, seoDescription: null, heroImageAlt: null,
      ogTitle: null, ogDescription: null, cta: null, internalLinks: null,
    };
    expect(computeBlogAtomicSourceHash({ ...base, showAuthor: true }))
      .not.toBe(computeBlogAtomicSourceHash({ ...base, showAuthor: false }));
  });

  it('suppresses author in Turkish/localized pages and both feeds when disabled', () => {
    expect(read('app/blog/[slug]/page.tsx')).toMatch(/post\.showAuthor && post\.author\?\.trim\(\)/);
    expect(read('app/blog/feed.xml/route.ts')).toMatch(/post\.showAuthor && post\.author\?\.trim\(\)/);
    expect(read('app/[lang]/blog/[slug]/page.tsx'))
      .toMatch(/translation\.sourceShowAuthor && translation\.sourceAuthor\?\.trim\(\)/);
    expect(read('app/[lang]/blog/feed.xml/route.ts'))
      .toMatch(/post\.sourceShowAuthor && post\.sourceAuthor\?\.trim\(\)/);
  });
});

describe('G6 pages delete action contract', () => {
  it('keeps Sil in canonical actions for every status and disables unsafe records with a reason', () => {
    const source = read('app/admin/_components/ContentList.tsx');
    expect(source).toContain('delete={{');
    expect(source).toMatch(/disabled: deleting === item\.id \|\| !isSafeToDelete/);
    expect(source).toMatch(/disabledReason: !isSafeToDelete \? deleteOmittedReason/);
    expect(source).toContain('handleDelete(item.id)');
  });
});