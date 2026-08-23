import { describe, expect, it } from 'vitest';
import { groupFleetVehicles, normalizeVehicleType } from '../../lib/vehicle-options';

describe('fleet grouping', () => {
  it('groups the public classes in fleet order and capacity order', () => {
    const grouped = groupFleetVehicles([
      { vehicleType: 'BUS', passengerCapacity: 45 },
      { vehicleType: 'minibus', passengerCapacity: 19 },
      { vehicleType: 'MINIVAN', passengerCapacity: 7 },
      { vehicleType: 'minibus', passengerCapacity: 10 },
      { vehicleType: 'midibus', passengerCapacity: 25 },
      { vehicleType: 'minivan', passengerCapacity: 6 },
    ]);

    expect(grouped.map((group) => group.type)).toEqual(['minivan', 'minibus', 'midibus', 'bus']);
    expect(grouped[0].vehicles.map((vehicle) => vehicle.passengerCapacity)).toEqual([6, 7]);
    expect(grouped[1].vehicles.map((vehicle) => vehicle.passengerCapacity)).toEqual([10, 19]);
  });

  it('normalizes legacy stored values but rejects catalog-only classes', () => {
    expect(normalizeVehicleType('MINIBUS')).toBe('minibus');
    expect(normalizeVehicleType('SEDAN')).toBeNull();
  });
});