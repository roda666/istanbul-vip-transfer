import { describe, expect, it } from 'vitest';
import {
  mergeVerifiedIntroParagraph,
  parseTransferRouteAiDraft,
  validateTransferRouteAiInput,
} from '@/lib/transfer-route-ai';
import { isValidTransferRouteImagePath } from '@/lib/transfer-route-media';

const uuidA = '11111111-1111-4111-8111-111111111111';
const uuidB = '22222222-2222-4222-8222-222222222222';

describe('transfer route AI contracts', () => {
  it('requires managed, different location UUIDs', () => {
    expect(validateTransferRouteAiInput({
      name: 'Havalimanı rota',
      origin: 'İstanbul Havalimanı',
      destination: 'Taksim',
      originLocationId: uuidA,
      destinationLocationId: uuidB,
    }).ok).toBe(true);
    expect(validateTransferRouteAiInput({
      name: 'Havalimanı rota',
      origin: 'IST',
      destination: 'Taksim',
      originLocationId: uuidA,
      destinationLocationId: uuidA,
    }).ok).toBe(false);
  });

  it('always owns the first intro sentence with verified metrics', () => {
    expect(mergeVerifiedIntroParagraph('Yaklaşık 1 km. Konforlu bir seçimdir.', 42.3, 58))
      .toBe('Google Maps verisine göre bu rota 42.3 km ve 58 dakika sürer. Konforlu bir seçimdir.');
  });

  it('rejects service slugs outside the supplied published set', () => {
    const draft = {
      description: 'Güvenli rota açıklaması',
      introParagraph: 'Her zaman doğrulanmış rotayı kullanın.',
      transportOptions: [
        { name: 'Ekonomik seçenek', summary: 'Temel ulaşım.', downside: 'Daha uzun bekleme olabilir.' },
        { name: 'Konforlu seçenek', summary: 'Daha rahat.', downside: 'Kapasitesi sınırlı olabilir.' },
        { name: 'Özel transfer', summary: 'Kapıdan kapıya.', downside: 'Toplu taşımadan pahalıdır.' },
      ],
      routeNotes: ['Yoğunluk değişebilir.'],
      faqItems: Array.from({ length: 6 }, (_, index) => ({ question: `Soru ${index}`, answer: 'Yanıt.' })),
      seoTitle: 'İstanbul VIP Transfer',
      seoDescription: 'İstanbul transfer rotası hakkında bilgiler.',
      ogTitle: 'İstanbul VIP Transfer',
      ogDescription: 'Konforlu rota seçenekleri.',
      relatedServiceSlug: 'invented-service',
    };
    expect(parseTransferRouteAiDraft(draft, { distanceKm: 42, durationMinutes: 55 }, new Set(['vip-transfer'])))
      .toBeNull();
  });

  it('accepts only internal route image paths', () => {
    expect(isValidTransferRouteImagePath('/api/storage/objects/transfer-routes/ist-taksim/abc.webp')).toBe(true);
    expect(isValidTransferRouteImagePath('https://example.com/route.webp')).toBe(false);
  });
});
