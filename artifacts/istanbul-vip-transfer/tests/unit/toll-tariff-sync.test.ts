import { describe, expect, it } from 'vitest';
import { AVRASYA_TARIFF_URL, isSupportedOfficialTariff, parseAvrasyaTariffPage } from '@/lib/toll-tariff-sync';

const officialTable = `
  <table><tr><th>Otomobil</th><th>Minibüs</th><th>Motosiklet</th></tr>
  <tr><td>Gündüz 05:00 - 23:59</td><td>330,00 TL</td><td>495,00 TL</td><td>257,40 TL</td></tr>
  <tr><td>Gece 00:00 - 04:59</td><td>165,00 TL</td><td>247,50 TL</td><td>128,70 TL</td></tr></table>`;

describe('Avrasya official tariff sync adapter', () => {
  it('parses only the published day/night class columns as kurus', () => {
    expect(parseAvrasyaTariffPage(officialTable, 'DAY', 'class_1')).toBe(33000);
    expect(parseAvrasyaTariffPage(officialTable, 'NIGHT', 'class_6')).toBe(12870);
  });

  it('refuses unsupported rows and database-supplied lookalike URLs before any fetch', () => {
    expect(() => parseAvrasyaTariffPage(officialTable, 'ALL', 'class_1')).toThrow(/beklenen/i);
    expect(isSupportedOfficialTariff({ sourceUrl: `${AVRASYA_TARIFF_URL}?redirect=x`, timeBand: 'DAY', vehicleClass: 'class_1' })).toBe(false);
    expect(isSupportedOfficialTariff({ sourceUrl: AVRASYA_TARIFF_URL, timeBand: 'DAY', vehicleClass: 'class_3' })).toBe(false);
  });
});