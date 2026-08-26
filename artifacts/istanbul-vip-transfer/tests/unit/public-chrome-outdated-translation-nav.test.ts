import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression test for the observable "category didn't take effect in the
 * other 8 languages" bug.
 *
 * Root cause: `content.category` is a single shared column (correct — it is
 * never duplicated per locale), but the non-TR nav query only joined
 * PUBLISHED translations. Any TR edit that flips a service's translation to
 * OUTDATED (the normal, expected side effect of editing source content) made
 * that service silently vanish from the nav menu in that language, which
 * looked exactly like "the menu grouping isn't consistent across languages".
 *
 * The project's visitor-ready policy (see
 * .agents/memory/visitor-ready-translations.md and
 * lib/service-page-cms.ts getServicePage) is that DRAFT/REVIEW/APPROVED/
 * PUBLISHED/OUTDATED translations are all served to visitors. The nav must
 * honor the same set, or a fully-live page can disappear from its own
 * language's menu.
 */

const mocks = vi.hoisted(() => {
  const content = {
    slug: Symbol('slug'),
    title: Symbol('title'),
    category: Symbol('category'),
    contentType: Symbol('contentType'),
    status: Symbol('status'),
    isActive: Symbol('isActive'),
    showInNav: Symbol('showInNav'),
    displayOrder: Symbol('displayOrder'),
    id: Symbol('id'),
    body: Symbol('body'),
    slugCol: Symbol('slugCol'),
  };
  const contentTranslations = {
    entityId: Symbol('entityId'),
    targetLanguageCode: Symbol('targetLanguageCode'),
    entityType: Symbol('entityType'),
    status: Symbol('txStatus'),
    title: Symbol('txTitle'),
    body: Symbol('txBody'),
  };

  let capturedStatusFilter: unknown[] | null = null;

  return { content, contentTranslations, getCapturedStatusFilter: () => capturedStatusFilter, setCapturedStatusFilter: (v: unknown[]) => { capturedStatusFilter = v; } };
});

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
vi.mock('@/lib/public-chrome-cache', () => ({
  PUBLIC_CHROME_TAG: 'public-chrome',
  PUBLIC_CHROME_REVALIDATE_SECONDS: 300,
}));
vi.mock('@/lib/service-category-server', () => ({
  getServiceCategories: vi.fn().mockResolvedValue([
    { slug: 'airport', label: 'Havalimanı Transferleri' },
  ]),
}));
vi.mock('@/lib/site-settings-server', () => ({
  getContactSettings: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/lib/homepage-types', () => ({ HOMEPAGE_FALLBACK: { en: { footerSection: {} } } }));
vi.mock('@/db/schema', () => ({
  content: mocks.content,
  contentTranslations: mocks.contentTranslations,
}));

// A minimal drizzle-orm stub: `inArray` records which statuses the nav query
// asked for so the test can assert the fix without depending on drizzle's
// real SQL builder, and the query-chain mock below returns a fixed row set
// regardless of the exact filter shape.
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ $and: args }),
  asc: (col: unknown) => ({ $asc: col }),
  eq: (...args: unknown[]) => ({ $eq: args }),
  inArray: (col: unknown, values: unknown[]) => {
    mocks.setCapturedStatusFilter(values);
    return { $inArray: [col, values] };
  },
  sql: Object.assign((strings: TemplateStringsArray, ...exprs: unknown[]) => ({ $sql: [strings, exprs] }), {}),
}));

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
        innerJoin: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([
              // This service is OUTDATED in `en` but its content is fully
              // live and served on its own page — it must still show up in
              // the English nav menu.
              { slug: 'istanbul-havalimani-transfer', label: 'Istanbul Airport Transfer', category: 'airport' },
            ]),
          }),
        }),
        orderBy: () => Promise.resolve([]),
      }),
    }),
  },
}));

import { getPublicChrome } from '@/lib/public-chrome';

describe('public chrome nav honors the visitor-ready translation set', () => {
  beforeEach(() => {
    mocks.setCapturedStatusFilter([]);
  });

  it('queries DRAFT/REVIEW/APPROVED/PUBLISHED/OUTDATED for a non-TR locale, not PUBLISHED-only', async () => {
    await getPublicChrome('en');

    expect(mocks.getCapturedStatusFilter()).toEqual(
      expect.arrayContaining(['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'OUTDATED']),
    );
    expect(mocks.getCapturedStatusFilter()).not.toEqual(['PUBLISHED']);
  });

  it('still includes a service in its nav group even when only OUTDATED for that locale', async () => {
    const chrome = await getPublicChrome('en');

    const airportGroup = chrome.serviceNavigationGroups.find(g => g.slug === 'airport');
    expect(airportGroup?.items.map(i => i.slug)).toContain('istanbul-havalimani-transfer');
  });
});
