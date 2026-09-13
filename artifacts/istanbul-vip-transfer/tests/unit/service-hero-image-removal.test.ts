import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const makeQuery = (result: unknown[]) => ({
    from: () => ({
      where: () => ({
        limit: async () => result,
      }),
    }),
  });

  return {
    currentRow: null as Record<string, unknown> | null,
    reloadedRecord: null as Record<string, unknown> | null,
    updateFields: null as Record<string, unknown> | null,
    makeQuery,
    requireAdminSession: vi.fn(),
    getServicePageAdminRecord: vi.fn(),
    isServicePageBody: vi.fn(),
    computeTranslatableHash: vi.fn(),
    resolveImageField: vi.fn(),
    db: {
      select: vi.fn(),
      transaction: vi.fn(),
    },
    transaction: {
      execute: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
    },
  };
});

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
  ENTITY_TYPE: 'service_page',
  getServicePageAdminRecord: mocks.getServicePageAdminRecord,
}));
vi.mock('@/lib/service-page-types', () => ({
  applyTranslatedFields: vi.fn(),
  computeTranslatableHash: mocks.computeTranslatableHash,
  extractTranslatableFields: vi.fn(),
  isServicePageBody: mocks.isServicePageBody,
  parseServicePageBody: vi.fn(),
}));
vi.mock('@/lib/ai/translate-service-page', () => ({
  translateServicePageFields: vi.fn(),
}));
vi.mock('@/lib/service-image-assets', () => ({
  resolveImageField: mocks.resolveImageField,
  validateServiceImageAsset: vi.fn(),
}));
vi.mock('@/db', () => ({ db: mocks.db }));
vi.mock('@/db/schema', () => ({
  content: { id: 'id' },
  serviceCategories: { slug: 'slug', isActive: 'isActive' },
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn(() => 'and'),
  eq: vi.fn(() => 'eq'),
  sql: vi.fn(() => 'sql'),
}));

import { PATCH } from '../../app/admin/api/service-pages/[id]/route';

const validPatchBody = {
  title: 'VIP transfer',
  body: {},
  heroImage: null,
  heroImageAlt: 'Stale hero ALT text',
  ogImage: null,
  category: 'airport-transfer',
  saveAsDraft: false,
  autoTranslate: false,
};

function patchRequest() {
  return new Request('http://localhost/admin/api/service-pages/service-id', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPatchBody),
  }) as never;
}

describe('published service hero image removal', () => {
  beforeEach(() => {
    mocks.currentRow = {
      id: 'service-id',
      slug: 'vip-transfer',
      status: 'PUBLISHED',
      heroImage: '/api/storage/objects/existing-hero',
      ogImage: null,
      category: 'airport-transfer',
      publishedAt: new Date(),
    };
    mocks.reloadedRecord = {
      id: 'service-id',
      heroImage: null,
      heroImageAlt: null,
    };
    mocks.updateFields = null;
    mocks.requireAdminSession.mockResolvedValue({ adminId: 'admin-id' });
    mocks.getServicePageAdminRecord.mockResolvedValue(mocks.reloadedRecord);
    mocks.isServicePageBody.mockReturnValue(true);
    mocks.computeTranslatableHash.mockReturnValue('source-hash');
    mocks.resolveImageField.mockImplementation(async (value: string | null | undefined) => ({
      value: value?.trim() || null,
      warning: null,
    }));
    mocks.db.select.mockImplementation(() => mocks.makeQuery([mocks.currentRow]));
    mocks.transaction.select.mockImplementation(() => mocks.makeQuery([{ slug: 'airport-transfer' }]));
    mocks.transaction.update.mockImplementation(() => ({
      set: (fields: Record<string, unknown>) => {
        mocks.updateFields = fields;
        return { where: async () => undefined };
      },
    }));
    mocks.db.transaction.mockImplementation(async (
      callback: (transaction: typeof mocks.transaction) => Promise<boolean>,
    ) => callback(mocks.transaction));
  });

  it('persists null image and ALT fields, then returns the reloaded published record', async () => {
    const response = await PATCH(patchRequest(), { params: Promise.resolve({ id: 'service-id' }) });

    expect(response.status).toBe(200);
    expect(mocks.updateFields).toMatchObject({
      heroImage: null,
      heroImageAlt: null,
      status: 'PUBLISHED',
    });
    await expect(response.json()).resolves.toMatchObject({
      record: { heroImage: null, heroImageAlt: null },
    });
  });

  it('allows later published-page edits to retain the text-only hero', async () => {
    mocks.currentRow = { ...mocks.currentRow, heroImage: null };

    const response = await PATCH(patchRequest(), { params: Promise.resolve({ id: 'service-id' }) });

    expect(response.status).toBe(200);
    expect(mocks.updateFields).toMatchObject({
      heroImage: null,
      heroImageAlt: null,
    });
  });

  it('keeps the hero-image requirement for a draft service on first publication', async () => {
    mocks.currentRow = { ...mocks.currentRow, status: 'DRAFT' };

    const response = await PATCH(patchRequest(), { params: Promise.resolve({ id: 'service-id' }) });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Yayımlamak için hizmete özel bir hero görseli zorunludur.',
    });
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });
});