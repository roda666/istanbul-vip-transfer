import { describe, expect, it } from 'vitest';
import { requestsToExcel, requestsToPdf } from '@/lib/admin-request-export';

const row = { referenceNumber: 'IVT-1', name: 'Çağrı & Co', phone: '555', normalizedEmail: null, locale: 'tr', source: 'contact-form', serviceType: 'CONTACT_INQUIRY', intent: 'QUOTE', status: 'NEW', createdAt: '2025-01-01T10:00:00.000Z', requestData: { ucusNumarasi: 'TK123' } };

describe('admin request exports', () => {
  it('escapes spreadsheet XML values', () => expect(requestsToExcel([row])).toContain('Çağrı &amp; Co'));
  it('uses readable labels instead of internal codes in list exports', () => {
    const output = requestsToExcel([row, { ...row, referenceNumber: 'IVT-2' }]);
    expect(output).toContain('İletişim Talebi');
    expect(output).toContain('Fiyat Teklifi');
    expect(output).toContain('Yeni');
    expect(output).not.toContain('CONTACT_INQUIRY');
  });
  it('exports all detail fields when one request is selected', () => {
    const output = requestsToExcel([row]);
    expect(output).toContain('Uçuş Numarası');
    expect(output).toContain('TK123');
  });
  it('creates a PDF document', () => expect(requestsToPdf([row]).subarray(0, 8).toString()).toBe('%PDF-1.4'));
});