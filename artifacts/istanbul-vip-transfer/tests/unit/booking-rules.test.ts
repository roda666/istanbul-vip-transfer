import { describe, expect, it } from 'vitest';
import { formatServiceDate } from '../../lib/booking-date';
import {
  isFiveMinuteIncrement,
  isValidPassengerCount,
  findSmallestFittingVehicle,
  meetsAllocationMinimum,
} from '../../lib/booking-rules';

describe('booking date formatting', () => {
  it('keeps the WhatsApp date in DD.MM.YYYY', () => {
    expect(formatServiceDate('2026-08-21', 'tr')).toBe('21.08.2026');
  });

  it('keeps the operational format independent of the visitor locale', () => {
    expect(formatServiceDate('2026-08-21', 'en')).toBe('21.08.2026');
    expect(formatServiceDate('2026-08-21', 'de')).toBe('21.08.2026');
  });
});

describe('booking constraints', () => {
  it('accepts only 1–45 passengers', () => {
    expect(isValidPassengerCount(1)).toBe(true);
    expect(isValidPassengerCount(45)).toBe(true);
    expect(isValidPassengerCount(46)).toBe(false);
    expect(isValidPassengerCount(0)).toBe(false);
  });

  it('recommends the smallest fitting published vehicle at fleet boundaries', () => {
    const fleet = [6, 7, 10, 13, 15, 19, 25, 45].map((passengerCapacity) => ({ passengerCapacity }));
    expect(findSmallestFittingVehicle(fleet, 1)?.passengerCapacity).toBe(6);
    expect(findSmallestFittingVehicle(fleet, 7)?.passengerCapacity).toBe(7);
    expect(findSmallestFittingVehicle(fleet, 8)?.passengerCapacity).toBe(10);
    expect(findSmallestFittingVehicle(fleet, 14)?.passengerCapacity).toBe(15);
    expect(findSmallestFittingVehicle(fleet, 20)?.passengerCapacity).toBe(25);
    expect(findSmallestFittingVehicle(fleet, 26)?.passengerCapacity).toBe(45);
    expect(findSmallestFittingVehicle(fleet, 45)?.passengerCapacity).toBe(45);
    expect(findSmallestFittingVehicle(fleet, 46)).toBeNull();
  });

  it('accepts only five-minute time increments', () => {
    expect(isFiveMinuteIncrement('00')).toBe(true);
    expect(isFiveMinuteIncrement('55')).toBe(true);
    expect(isFiveMinuteIncrement('07')).toBe(false);
  });

  it('requires at least four hours for vehicle allocation', () => {
    expect(meetsAllocationMinimum(4, 'SAAT')).toBe(true);
    expect(meetsAllocationMinimum(3, 'SAAT')).toBe(false);
    expect(meetsAllocationMinimum(1, 'GUN')).toBe(true);
  });
});