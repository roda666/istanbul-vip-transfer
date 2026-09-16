import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CUSTOMER_TRANSLATION_LOCALES,
  computeCustomerContentSourceHash,
  customerTranslationEntityId,
  installCustomerTranslationTestProvider,
  runCustomerTranslationProvider,
} from '@/lib/customer-content-translation';

describe('customer content translation orchestration contract', () => {
  afterEach(() => installCustomerTranslationTestProvider(null));

  it('targets exactly the eight supported non-Turkish locales', () => {
    expect(CUSTOMER_TRANSLATION_LOCALES).toEqual(['en', 'de', 'ru', 'ar', 'es', 'fr', 'it', 'nl']);
    expect(CUSTOMER_TRANSLATION_LOCALES).not.toContain('tr');
  });

  it('hashes the complete source snapshot deterministically', () => {
    expect(computeCustomerContentSourceHash({ title: 'Başlık', body: { b: 2, a: 1 } }))
      .toBe(computeCustomerContentSourceHash({ body: { a: 1, b: 2 }, title: 'Başlık' }));
    expect(computeCustomerContentSourceHash({ title: 'Bir' }))
      .not.toBe(computeCustomerContentSourceHash({ title: 'İki' }));
  });

  it('keeps category adapter ids UUID-shaped without changing the source id', () => {
    const adapted = customerTranslationEntityId('category', '42');
    expect(adapted).toMatch(/^[0-9a-f-]{36}$/);
    expect(customerTranslationEntityId('category', '42')).toBe(adapted);
    expect(customerTranslationEntityId('category', '43')).not.toBe(adapted);
  });

  it('uses the fake provider seam and makes no real provider call', async () => {
    const realProvider = vi.fn();
    const fakeProvider = vi.fn(async () => ({ ok: true, fields: { title: 'Translated' } }));
    installCustomerTranslationTestProvider(fakeProvider);
    const result = await runCustomerTranslationProvider({
      entityType: 'content',
      entityId: '00000000-0000-0000-0000-000000000001',
      targetLanguageCode: 'en',
      sourceHash: 'source-hash',
    });
    expect(result).toEqual({ ok: true, fields: { title: 'Translated' } });
    expect(fakeProvider).toHaveBeenCalledOnce();
    expect(realProvider).not.toHaveBeenCalled();
  });
});