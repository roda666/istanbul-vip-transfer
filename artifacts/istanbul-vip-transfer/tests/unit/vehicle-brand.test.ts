import { describe, expect, it } from 'vitest';
import { resolveVehicleBrand } from '../../lib/vehicle-brand';

describe('vehicle JSON-LD brand resolver', () => {
  it('assigns Mercedes-Benz only to Mercedes-named vehicles', () => {
    expect(resolveVehicleBrand('Mercedes Sprinter 13')).toEqual({
      '@type': 'Brand',
      name: 'Mercedes-Benz',
    });
  });

  it('assigns Volkswagen to the Transporter rather than Mercedes', () => {
    expect(resolveVehicleBrand('Volkswagen Transporter')).toEqual({
      '@type': 'Brand',
      name: 'Volkswagen',
    });
    expect(resolveVehicleBrand('Volkswagen Transporter')).not.toEqual({
      '@type': 'Brand',
      name: 'Mercedes-Benz',
    });
  });

  it('omits unverified brands for generic midibus and coach records', () => {
    expect(resolveVehicleBrand('Yarım otobüs')).toBeUndefined();
    expect(resolveVehicleBrand('Otobüs')).toBeUndefined();
  });
});