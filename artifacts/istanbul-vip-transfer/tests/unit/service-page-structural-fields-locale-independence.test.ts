import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Regression test for the "category only changed in Turkish" bug.
 *
 * Category (and other structural fields: displayOrder, isActive, indexable,
 * showOnHomepage, showInNav) live on the single shared `content` row, not on
 * per-locale `content_translations` rows. They must never be written by the
 * `saveTranslation` action (used by the non-TR locale tabs) — only the shared
 * PATCH route may write them, so there can never be a locale-specific
 * divergence of a structural field.
 */

const mocks = vi.hoisted(() => {
  const content = {
    id: Symbol('contentId'),
    contentType: Symbol('contentType'),
    category: Symbol('category'),
    displayOrder: Symbol('displayOrder'),
    isActive: Symbol('isActive'),
    indexable: Symbol('indexable'),
    status: Symbol('status'),
    updatedAt: Symbol('updatedAt'),
  };
  const contentTranslations = {
    id: Symbol('txId'),
    entityType: Symbol('entityType'),
    entityId: Symbol('entityId'),
    targetLanguageCode: Symbol('targetLanguageCode'),
    status: Symbol('txStatus'),
    title: Symbol('title'),
    excerpt: Symbol('excerpt'),
    body: Symbol('body'),
    metaTitle: Symbol('metaTitle'),
    metaDescription: Symbol('metaDescription'),
    isManuallyLocked: Symbol('isManuallyLocked'),
    updatedBy: Symbol('updatedBy'),
    updatedAt: Symbol('txUpdatedAt'),
    publishedAt: Symbol('publishedAt'),
  };

  const contentRow = {
    id: 'service-1',
    slug: 'ankara-vip-transfer',
    category: 'city_vip',
    contentType: 'SERVICE',
  };
  const translationRow = {
    id: 'tx-1',
    status: 'DRAFT',
    body: '{"version":2}',
  };

  const selectBuilder = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  };

  const updateSetCalls: { table: 'content' | 'contentTranslations'; values: Record<string, unknown> }[] = [];

  return {
    content,
    contentTranslations,
    contentRow,
    translationRow,
    selectBuilder,
    updateSetCalls,
    db: {
      select: vi.fn(() => selectBuilder),
      update: vi.fn((table: unknown) => ({
        set: (values: Record<string, unknown>) => {
          updateSetCalls.push({
            table: table === content ? 'content' : 'contentTranslations',
            values,
          });
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      })),
      insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
    },
    requireAdminSession: vi.fn(),
    getServicePageAdminRecord: vi.fn(),
  };
});

vi.mock('server-only', () => ({}));
vi.mock('@/db', () => ({ db: mocks.db }));
vi.mock('@/db/schema', () => ({
  content: mocks.content,
  contentTranslations: mocks.contentTranslations,
}));
vi.mock('@/lib/auth/session', () => ({
  requireAdminSession: mocks.requireAdminSession,
}));
vi.mock('@/lib/homepage-revalidation', () => ({
  revalidateAllHomepagesForServiceChange: vi.fn(),
  revalidateHomepageForServiceTranslation: vi.fn(),
  revalidatePublicServiceCatalog: vi.fn(),
  revalidatePublicServiceDetail: vi.fn(),
}));
vi.mock('@/lib/service-category-server', () => ({
  invalidateServiceCategories: vi.fn(),
}));
vi.mock('@/lib/service-page-cms', () => ({
  getServicePageAdminRecord: mocks.getServicePageAdminRecord,
  ENTITY_TYPE: 'service_page',
}));
vi.mock('@/lib/service-page-types', () => ({
  parseServicePageBody: vi.fn((b: unknown) => b),
  extractTranslatableFields: vi.fn(),
  computeTranslatableHash: vi.fn(),
  applyTranslatedFields: vi.fn(),
  isServicePageBody: vi.fn(() => true),
}));
vi.mock('@/lib/ai/translate-service-page', () => ({
  translateServicePageFields: vi.fn(),
}));
vi.mock('@/lib/site-config', () => ({ SITE: { siteUrl: 'https://example.com' } }));
vi.mock('@/lib/service-image-assets', () => ({
  resolveImageField: vi.fn(),
  validateServiceImageAsset: vi.fn(),
}));

import { POST } from '../../app/admin/api/service-pages/[id]/route';

function actionRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/admin/api/service-pages/service-1', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('service page structural fields stay locale-independent', () => {
  beforeEach(() => {
    mocks.updateSetCalls.length = 0;
    mocks.requireAdminSession.mockResolvedValue({ adminId: 'admin-1' });
    mocks.getServicePageAdminRecord.mockResolvedValue({ id: 'service-1' });
    mocks.selectBuilder.limit
      .mockResolvedValueOnce([mocks.contentRow]) // getContent
      .mockResolvedValueOnce([mocks.translationRow]); // getTranslation
  });

  it('never writes category (or other structural fields) when saving a non-TR locale tab', async () => {
    const res = await POST(
      actionRequest({
        action: 'saveTranslation',
        locale: 'en',
        title: 'Ankara VIP Transfer',
        excerpt: 'Excerpt',
        body: { version: 2 },
        metaTitle: 'Meta title',
        metaDescription: 'Meta description',
        // A structural field smuggled in by a buggy client must never reach the DB write —
        // this is exactly what the "category only changed in Turkish" bug looked like from
        // the outside: an EN/DE/RU/... tab silently failing to persist a shared field.
        category: 'tour',
        isActive: false,
        displayOrder: 99,
        indexable: false,
      }),
      { params: Promise.resolve({ id: 'service-1' }) },
    );

    expect(res.status).toBe(200);

    const translationWrite = mocks.updateSetCalls.find(c => c.table === 'contentTranslations');
    expect(translationWrite).toBeDefined();
    for (const structuralField of ['category', 'isActive', 'displayOrder', 'indexable', 'showOnHomepage', 'showInNav']) {
      expect(translationWrite!.values).not.toHaveProperty(structuralField);
    }

    // The shared `content` row (where category actually lives) must not be touched
    // by a translation-tab save — category can only change through the shared PATCH path.
    const contentWrite = mocks.updateSetCalls.find(c => c.table === 'content');
    expect(contentWrite).toBeUndefined();
  });
});
