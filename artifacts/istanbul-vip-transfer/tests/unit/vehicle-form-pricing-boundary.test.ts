import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(__dirname, path), 'utf8');

describe('vehicle form and pricing formula boundary', () => {
  it('updates an existing vehicle by id and creates only from the new-vehicle endpoint', () => {
    const form = read('../../app/admin/(protected)/araclar/_VehicleForm.tsx');
    const createRoute = read('../../app/admin/api/vehicles/route.ts');
    const updateRoute = read('../../app/admin/api/vehicles/[id]/route.ts');

    expect(form).toContain("const method = isEdit ? 'PUT' : 'POST'");
    expect(form).toContain('`/admin/api/vehicles/${vehicle!.id}`');
    expect(createRoute).toContain('.insert(vehicles)');
    expect(updateRoute).toContain('.update(vehicles)');
    expect(updateRoute).not.toContain('.insert(vehicles)');
  });

  it('keeps only the toll vehicle class in the vehicle form contract', () => {
    const form = read('../../app/admin/(protected)/araclar/_VehicleForm.tsx');
    const createRoute = read('../../app/admin/api/vehicles/route.ts');
    const updateRoute = read('../../app/admin/api/vehicles/[id]/route.ts');

    for (const removed of [
      'priceCalculationEligible',
      'pricingClass',
      'tollClassSourceUrl',
      'tollClassEvidence',
    ]) {
      expect(form).not.toContain(removed);
      expect(createRoute).not.toContain(removed);
      expect(updateRoute).not.toContain(removed);
    }
    expect(form).toContain('data-testid="vehicle-toll-class"');
    expect(form).toContain('TOLL_VEHICLE_CLASSES.map');
  });

  it('creates pricing profiles only through the explicit central profile endpoint', () => {
    const createVehicleRoute = read('../../app/admin/api/vehicles/route.ts');
    const updateVehicleRoute = read('../../app/admin/api/vehicles/[id]/route.ts');
    const profileRoute = read('../../app/admin/api/pricing/profiles/route.ts');
    const pricingClient = read('../../app/admin/(protected)/fiyat-kurallari/_FormulaPricingClient.tsx');

    expect(createVehicleRoute).not.toContain('vehiclePricingProfiles');
    expect(updateVehicleRoute).not.toContain('vehiclePricingProfiles');
    expect(profileRoute).toContain('tx.insert(vehiclePricingProfiles)');
    expect(profileRoute).toContain('priceCalculationEligible: true');
    expect(pricingClient).toContain('data-testid="new-pricing-formula"');
    expect(pricingClient).not.toContain('vehicles.filter((v: Vehicle) => v.priceCalculationEligible)');
  });
});