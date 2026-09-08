import { describe, expect, it } from 'vitest';
import { requestsToExcel, requestsToPdf } from '@/lib/admin-request-export';

const row = { referenceNumber: 'IVT-1', name: 'Çağrı & Co', phone: '555', normalizedEmail: null, locale: 'tr', source: 'contact-form', pageSlug: '/iletisim', serviceType: 'CONTACT_INQUIRY', intent: 'QUOTE', status: 'NEW', createdAt: '2025-01-01T10:00:00.000Z' };

describe('admin request exports', () => {
  it('escapes spreadsheet XML values', () => expect(requestsToExcel([row])).toContain('Çağrı &amp; Co'));
  it('creates a PDF document', () => expect(requestsToPdf([row]).subarray(0, 8).toString()).toBe('%PDF-1.4'));
});