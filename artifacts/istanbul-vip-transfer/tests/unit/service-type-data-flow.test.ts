import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  localizeServiceType,
  serviceTypeKeyFromLabel,
} from '@/lib/service-type-localization';

const appRoot = resolve(process.cwd());
const source = (path: string) => readFileSync(resolve(appRoot, path), 'utf8');

describe('service type localization', () => {
  it('uses the requested DB translation and falls back to the owner Turkish text', () => {
    const row = {
      id: 'id',
      key: 'ALLOCATION',
      label: 'Araç Tahsisi/Şoförlü Araç Kiralama',
      description: 'Saatlik veya günlük özel araç ve şoför tahsisi.',
      translations: {
        en: {
          label: 'Vehicle Allocation/Chauffeured Car Rental',
          description: 'Private vehicle and driver allocation by the hour or day.',
        },
      },
    };
    expect(localizeServiceType(row, 'en').label)
      .toBe('Vehicle Allocation/Chauffeured Car Rental');
    expect(localizeServiceType(row, 'de').label)
      .toBe('Araç Tahsisi/Şoförlü Araç Kiralama');
  });

  it('derives a stable non-customer-facing key from Turkish owner text', () => {
    expect(serviceTypeKeyFromLabel('Şoförlü Araç Kiralama'))
      .toBe('SOFORLU_ARAC_KIRALAMA');
  });
});

describe('service type public/admin contract', () => {
  it('renders the DB-provided localized label instead of the old dictionary override', () => {
    const bookingForm = source('components/BookingForm.tsx');
    expect(bookingForm).not.toContain('const ST_LABELS');
    expect(bookingForm).toContain('{st.label}');
    expect(bookingForm).toContain('const serviceLabel = activeST?.label ?? activeService');
  });

  it('keeps public service type reads authoritative and uncached', () => {
    const bootstrap = source('lib/booking-form-bootstrap.ts');
    const publicRoute = source('app/data/service-types/route.ts');
    expect(bootstrap).toContain('translations: serviceTypes.translations');
    expect(bootstrap).toContain('localizeServiceType(row, lang)');
    expect(bootstrap).not.toContain('serviceRows.length ? serviceRows : FALLBACK_BOOKING_SERVICE_TYPES');
    expect(publicRoute).toContain("'Cache-Control': 'no-store, max-age=0, must-revalidate'");
    expect(publicRoute).not.toContain('Return hardcoded fallback');
  });

  it('offers create and only one cancel path while editing', () => {
    const client = source('app/admin/(protected)/rezervasyon-ayarlari/_ReservasyonAyarlariClient.tsx');
    expect(client).toContain('label=\"Yeni Hizmet Türü Ekle\"');
    expect(client).toContain('<Btn variant=\"ghost\" onClick={cancel}>İptal</Btn>');
    expect(client).not.toContain("label={editing ? 'Kapat' : 'Düzenle'}");
  });

  it('auto-translates create/update and invalidates the real booking bootstrap', () => {
    const collectionRoute = source('app/admin/api/service-types/route.ts');
    const itemRoute = source('app/admin/api/service-types/[id]/route.ts');
    for (const route of [collectionRoute, itemRoute]) {
      expect(route).toContain('syncServiceTypeTranslations');
      expect(route).toContain('revalidateBookingFormBootstrap');
    }
    expect(itemRoute).toContain('hasMissingTranslation');
  });
});