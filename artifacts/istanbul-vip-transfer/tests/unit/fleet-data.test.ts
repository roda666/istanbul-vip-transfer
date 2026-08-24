import { describe, expect, it } from 'vitest';
import { ARCHIVED_SLUGS, VEHICLES } from '../../scripts/fleet-data.mjs';
import { groupFleetVehicles } from '../../lib/vehicle-options';

const LANGUAGES = ['tr', 'en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'];

describe('authoritative fleet catalog', () => {
  it('contains the eight capacity-safe pricing vehicles and request-only options', () => {
    expect(VEHICLES.map((vehicle: typeof VEHICLES[number]) => ({
      slug: vehicle.slug, type: vehicle.vehicleType,
      passengers: vehicle.passengerCapacity, luggage: vehicle.luggageCapacity,
    }))).toEqual([
      { slug: 'mercedes-vito', type: 'minivan', passengers: 6, luggage: 5 },
      { slug: 'vw-transporter', type: 'minivan', passengers: 7, luggage: 6 },
      { slug: 'mercedes-sprinter-10', type: 'minibus', passengers: 10, luggage: 10 },
      { slug: 'mercedes-sprinter-vip', type: 'minibus', passengers: 13, luggage: 13 },
      { slug: 'mercedes-sprinter-15', type: 'minibus', passengers: 15, luggage: 15 },
      { slug: 'mercedes-sprinter-19', type: 'minibus', passengers: 19, luggage: 19 },
      { slug: 'midibus-25', type: 'midibus', passengers: 25, luggage: 25 },
      { slug: 'coach-45', type: 'bus', passengers: 45, luggage: 45 },
      { slug: 'mercedes-e-class', type: 'minivan', passengers: 4, luggage: 4 },
      { slug: 'mercedes-s-class', type: 'minivan', passengers: 4, luggage: 3 },
      { slug: 'mercedes-v-class', type: 'minivan', passengers: 7, luggage: 8 },
    ]);
    expect(VEHICLES.every((vehicle: typeof VEHICLES[number]) => vehicle.status === 'PUBLISHED')).toBe(true);
    expect(VEHICLES.filter((vehicle: typeof VEHICLES[number]) => vehicle.priceCalculationEligible).map((vehicle: typeof VEHICLES[number]) => vehicle.slug)).toEqual([
      'mercedes-vito', 'vw-transporter', 'mercedes-sprinter-10', 'mercedes-sprinter-vip',
      'mercedes-sprinter-15', 'mercedes-sprinter-19', 'midibus-25', 'coach-45',
    ]);
  });

  it('gives every public record its own image and meaningful alt text', () => {
    const images = VEHICLES.map((vehicle: typeof VEHICLES[number]) => vehicle.coverImage);
    expect(new Set(images).size).toBe(VEHICLES.length);
    expect(VEHICLES.every((vehicle: typeof VEHICLES[number]) => vehicle.coverImage && vehicle.coverImageAlt.trim())).toBe(true);
  });

  it('has complete real locale fields without Turkish source fallback', () => {
    for (const vehicle of VEHICLES) {
      for (const language of LANGUAGES) {
        expect(vehicle.nameTranslations[language]?.trim()).toBeTruthy();
        expect(vehicle.shortDescTranslations[language]?.trim()).toBeTruthy();
        expect(vehicle.taglineTranslations[language]?.trim()).toBeTruthy();
      }
      for (const language of LANGUAGES.slice(1)) {
        expect(vehicle.shortDescTranslations[language]).not.toBe(vehicle.shortDescTranslations.tr);
        expect(vehicle.taglineTranslations[language]).not.toBe(vehicle.taglineTranslations.tr);
      }
    }
  });

  it('keeps request-only sedan/MPV rows visible and out of automatic pricing', () => {
    expect(ARCHIVED_SLUGS).toEqual([]);
    expect(VEHICLES.filter((vehicle: typeof VEHICLES[number]) => ['mercedes-e-class', 'mercedes-s-class', 'mercedes-v-class'].includes(vehicle.slug))
      .every((vehicle: typeof VEHICLES[number]) => !vehicle.priceCalculationEligible && vehicle.features.length === 0)).toBe(true);
  });

  it('groups catalog capacity order for the dedicated public fleet page', () => {
    expect(groupFleetVehicles(VEHICLES).map((group) => ({
      type: group.type,
      capacities: group.vehicles.map((vehicle) => vehicle.passengerCapacity),
    }))).toEqual([
      { type: 'minivan', capacities: [4, 4, 6, 7, 7] },
      { type: 'minibus', capacities: [10, 13, 15, 19] },
      { type: 'midibus', capacities: [25] },
      { type: 'bus', capacities: [45] },
    ]);
  });
});