import { describe, expect, it } from 'vitest';
import { defaultTollVehicleClassForType, defaultTollVehicleClassForVehicle, groupFleetVehicles, isVehicleTypeBanned, normalizeVehicleType } from '../../lib/vehicle-options';

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

    expect(grouped.map((group) => group.type)).toEqual(['automobile', 'minibus', 'midibus', 'bus']);
    expect(grouped[0].vehicles.map((vehicle) => vehicle.passengerCapacity)).toEqual([6, 7]);
    expect(grouped[1].vehicles.map((vehicle) => vehicle.passengerCapacity)).toEqual([10, 19]);
  });

  it('normalizes legacy stored values but rejects catalog-only classes', () => {
    expect(normalizeVehicleType('MINIBUS')).toBe('minibus');
    expect(normalizeVehicleType('MINIVAN')).toBe('automobile');
    expect(normalizeVehicleType('SEDAN')).toBeNull();
  });

  it('suggests a toll panel class without conflating it with an operator override', () => {
    expect(defaultTollVehicleClassForType('automobile')).toBe('class_1');
    expect(defaultTollVehicleClassForType('minivan')).toBe('class_1');
    expect(defaultTollVehicleClassForType('minibus')).toBe('class_2');
    expect(defaultTollVehicleClassForType('midibus')).toBe('class_2');
    expect(defaultTollVehicleClassForType('bus')).toBe('class_3');
    expect(defaultTollVehicleClassForType('unknown')).toBeNull();
    expect(defaultTollVehicleClassForVehicle('minivan', 'Mercedes Vito VIP')).toBe('class_2');
    expect(defaultTollVehicleClassForVehicle('automobile', 'Sprinter 19+1')).toBe('class_2');
  });

  it('honours type bans across the automobile/minivan compatibility alias', () => {
    expect(isVehicleTypeBanned('automobile', ['minivan'])).toBe(true);
    expect(isVehicleTypeBanned('minivan', ['automobile'])).toBe(true);
    expect(isVehicleTypeBanned('minibus', ['bus'])).toBe(false);
  });
});