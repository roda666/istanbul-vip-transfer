import { describe, expect, it } from 'vitest';
import { parseRequestExportIds, requestsToExcel, requestsToPdf } from '@/lib/admin-request-export';

const row = {
  referenceNumber: 'IVT-1',
  name: 'Çağrı & Co',
  phone: '+905551112233',
  normalizedEmail: 'test@example.com',
  locale: 'tr',
  source: 'booking-form',
  serviceType: 'AIRPORT_TRANSFER',
  intent: 'QUOTE',
  status: 'NEW',
  createdAt: '2025-01-01T10:00:00.000Z',
  requestData: {
    adSoyad: 'Tekrar Eden Ad',
    telefon: 'Tekrar Eden Telefon',
    email: 'duplicate@example.com',
    ucusNumarasi: 'TK123',
    alisLokasyonu: 'İstanbul Havalimanı (IST) (İstanbul)',
    varisLokasyonu: 'Taksim (İstanbul)',
    alisLokasyonuId: 'ec3d9952-340f-4f2d-b185-50800ae9f5d8',
    varisLokasyonuId: 'f68a05cf-4ae4-40e7-88f8-f5eb1afca54d',
    locationReferences: { alisLokasyonu: { id: 'hidden-id' } },
    communication: {
      newsletterOptIn: { status: 'started' },
      adminNotification: { status: 'sent', acceptedCount: 1, recipientCount: 1 },
      customerConfirmation: { status: 'sent', acceptedCount: 1 },
    },
  },
  adminNotes: 'Sürücü teyidi beklenecek.',
};

describe('admin request exports', () => {
  it('escapes spreadsheet XML values', () => expect(requestsToExcel([row])).toContain('Çağrı &amp; Co'));
  it('uses readable labels instead of internal codes in list exports', () => {
    const output = requestsToExcel([row, { ...row, referenceNumber: 'IVT-2' }]);
    expect(output).toContain('Havalimanı / Şehir İçi Transfer');
    expect(output).toContain('Fiyat Teklifi');
    expect(output).toContain('Yeni');
    expect(output).not.toContain('AIRPORT_TRANSFER');
  });
  it('renders multi-request PDFs as a landscape table with wrapped cells and repeated headers', () => {
    const rows = Array.from({ length: 40 }, (_, index) => ({
      ...row,
      referenceNumber: `IVT-LIST-${index + 1}`,
      name: `Uzun İsimli Test Yolcusu ${index + 1}`,
      normalizedEmail: `uzun-adresli-yolcu-${index + 1}@example.test`,
      source: 'booking-form:AIRPORT_TRANSFER',
    }));
    const output = requestsToPdf(rows).toString('utf8');
    expect(output).toContain('/MediaBox [0 0 842 595]');
    expect(output.match(/\(Referans\)/g)?.length).toBeGreaterThan(1);
    expect(output).toContain('Rezervasyon Formu');
    expect(output).toContain('Havalimani Transferi');
    expect(output).not.toContain('booking-form:AIRPORT_TRANSFER');
    expect(output).not.toContain(' | ');
    expect(output).not.toContain('Hav...');
  });
  it('exports all detail fields when one request is selected', () => {
    const output = requestsToExcel([row]);
    expect(output).toContain('Uçuş Numarası');
    expect(output).toContain('TK123');
  });
  it('groups detailed exports and excludes duplicated or technical request fields', () => {
    const output = requestsToExcel([row]);
    expect(output).toContain('İletişim Bilgileri');
    expect(output).toContain('Talep-Hizmet Bilgileri');
    expect(output).toContain('Yolculuk Detayları');
    expect(output).toContain('Yönetici Notları');
    expect(output.match(/Ad Soyad/g)).toHaveLength(1);
    expect(output).toContain('Yönetici Bildirimi');
    expect(output).not.toContain('Tekrar Eden Ad');
    expect(output).not.toContain('alisLokasyonuId');
    expect(output).not.toContain('ec3d9952-340f-4f2d-b185-50800ae9f5d8');
    expect(output).not.toContain('locationReferences');
    expect(output).not.toContain('[object Object]');
  });
  it('uses professional section blocks in detailed PDF output without technical fields', () => {
    const output = requestsToPdf([row]).toString('utf8');
    expect(output).toContain('REZERVASYON KARTI');
    expect(output).toContain('Iletisim Bilgileri');
    expect(output).toContain('Yolculuk Detaylari');
    expect(output).not.toContain('alisLokasyonuId');
    expect(output).not.toContain('[object Object]');
  });
  it('creates a PDF document', () => expect(requestsToPdf([row]).subarray(0, 8).toString()).toBe('%PDF-1.4'));
  it('reads repeated selected IDs and keeps backwards compatibility with comma-separated IDs', () => {
    const params = new URLSearchParams();
    params.append('ids', 'request-1');
    params.append('ids', 'request-2,request-3');
    params.append('ids', 'request-2');
    expect(parseRequestExportIds(params)).toEqual(['request-1', 'request-2', 'request-3']);
  });
});