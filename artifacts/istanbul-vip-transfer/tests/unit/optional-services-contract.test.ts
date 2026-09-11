import { describe, expect, it } from 'vitest';
import { calculateAdminQuote } from '@/lib/admin-pricing-engine';
import { buildRequestPresentation } from '@/lib/admin-request-presentation';

const profile = {
  mode: 'DISTANCE' as const,
  openingKurus: 100,
  firstKmKurus: 10,
  thresholdKm: 10,
  secondKmKurus: 10,
};

describe('optional service pricing contract', () => {
  it('resolves foreign currency services before the single VAT/rounding chain', () => {
    const result = calculateAdminQuote({
      vehicleEligible: true, profile, distanceKm: 10, tripType: 'ONE_WAY',
      services: [{ id: 's', name: 'Meet', quantity: 1, unitAmount: 100, currency: 'EUR', includedInTransfer: false }],
      vatRateBasisPoints: 2000, vatDisplayMode: 'EXCLUDED',
      rates: { eurTryMicros: 30_000_000, eurUsdMicros: 1_000_000 },
      rounding: { eurCents: 500, usdCents: 500, tryKurus: 5000 },
    });
    expect(result.state).toBe('AVAILABLE');
    if (result.state !== 'AVAILABLE') return;
    expect(result.lines.find((line) => line.key === 'service:s')?.amountKurus).toBe(3000);
    expect(result.lines.filter((line) => line.key === 'service:s')).toHaveLength(1);
  });

  it('keeps included and customer-selected lines distinct', () => {
    const result = calculateAdminQuote({
      vehicleEligible: true, profile, distanceKm: 10, tripType: 'ONE_WAY',
      services: [
        { id: 'auto', name: 'Auto', quantity: 1, unitAmount: 100, currency: 'TRY', includedInTransfer: true },
        { id: 'selected', name: 'Selected', quantity: 2, unitAmount: 50, currency: 'TRY', includedInTransfer: false },
      ],
      vatRateBasisPoints: 2000, vatDisplayMode: 'EXCLUDED',
      rates: { eurTryMicros: 30_000_000, eurUsdMicros: 1_000_000 },
      rounding: { eurCents: 500, usdCents: 500, tryKurus: 5000 },
    });
    expect(result.state).toBe('AVAILABLE');
    if (result.state !== 'AVAILABLE') return;
    expect(result.lines.find((line) => line.key === 'service:auto')?.visibleToCustomer).toBe(false);
    expect(result.lines.find((line) => line.key === 'service:selected')?.visibleToCustomer).toBe(true);
  });
});

describe('optional service reservation snapshot presentation', () => {
  it('renders only the immutable server snapshot, not arbitrary request fields', () => {
    const sections = buildRequestPresentation({
      referenceNumber: 'IVT-test', name: 'Test', phone: 'x', normalizedEmail: null,
      locale: 'tr', source: 'test', serviceType: 'AIRPORT_TRANSFER', intent: 'QUOTE',
      status: 'NEW', createdAt: new Date(0), requestData: { injectedLabel: 'ignore' },
      optionalServicesSnapshot: [{ id: 's', name: 'Bebek koltuğu', quantity: 2, unitAmount: 1250, currency: 'TRY', includedInTransfer: false }],
    });
    const optional = sections.find((section) => section.key === 'optional-services');
    expect(optional?.fields[0]?.value).toContain('2 adet');
    expect(sections.flatMap((section) => section.fields).some((field) => field.value.includes('ignore'))).toBe(false);
  });
});