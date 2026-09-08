import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  supported: vi.fn(),
  fetch: vi.fn(),
  sign: vi.fn(),
  verify: vi.fn(),
  updateSet: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock('@/db', () => ({ db: { select: mocks.select, update: mocks.update, insert: mocks.insert } }));
vi.mock('@/lib/toll-tariff-sync', () => ({
  isSupportedOfficialTariff: mocks.supported,
  fetchSupportedOfficialTariff: mocks.fetch,
  signTariffSyncPreview: mocks.sign,
  verifyTariffSyncPreview: mocks.verify,
}));

import { POST } from '../../app/admin/api/pricing/tolls/sync/route';

const id = '00000000-0000-4000-8000-000000000001';
const tariff = { id, sourceVerified: true, sourceName: 'Avrasya', sourceUrl: 'https://www.avrasyatuneli.com/ucretlendirme/', vehicleClass: 'class_1', timeBand: 'DAY', manualAmountKurus: 999 };
const request = (body: unknown) => new Request('http://localhost/admin/api/pricing/tolls/sync', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }) as never;

describe('toll tariff sync route', () => {
  beforeEach(() => {
    mocks.requireAdminSession.mockResolvedValue({ adminId: '00000000-0000-4000-8000-000000000099' });
    mocks.select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [tariff] }) }) });
    mocks.update.mockReset();
    mocks.insert.mockReset();
    mocks.supported.mockReturnValue(true);
    mocks.fetch.mockResolvedValue({ amountKurus: 33000, sourceName: 'Avrasya Tüneli İşletme A.Ş. — Ücretler', sourceUrl: tariff.sourceUrl, fetchedAt: new Date('2026-01-01T00:00:00Z'), queriedAt: new Date('2026-01-01T00:00:00Z'), validFrom: null });
    mocks.sign.mockReturnValue('signed-preview-token');
  });

  it('previews a supported source without writing the tariff', async () => {
    const response = await POST(request({ action: 'preview', tollTariffId: id }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ newAmountKurus: 33000, previewToken: 'signed-preview-token', requiresConfirmation: true });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('requires the signed preview token before apply and preserves the manual effective amount', async () => {
    const blocked = await POST(request({ action: 'apply', tollTariffId: id, confirmationText: 'TARİFEYİ UYGULA' }));
    expect(blocked.status).toBe(422);
    mocks.verify.mockReturnValue({ amountKurus: 33000, sourceName: 'Avrasya Tüneli İşletme A.Ş. — Ücretler', sourceUrl: tariff.sourceUrl, fetchedAt: '2026-01-01T00:00:00.000Z', queriedAt: '2026-01-01T00:00:00.000Z' });
    mocks.update.mockReturnValue({ set: mocks.updateSet.mockImplementation((values: Record<string, unknown>) => ({ where: () => ({ returning: async () => [{ ...tariff, ...values }] }) })) });
    mocks.insert.mockReturnValue({ values: async () => undefined });
    const response = await POST(request({ action: 'apply', tollTariffId: id, confirmationText: 'TARİFEYİ UYGULA', previewToken: 'signed-preview-token' }));
    expect(response.status).toBe(200);
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ automaticAmountKurus: 33000, amountKurus: 999, validFrom: null }));
  });
});