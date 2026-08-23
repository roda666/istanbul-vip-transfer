import { describe, expect, it } from 'vitest';
import { resolvePublicVehicle, resolvePublishedVehicles } from '../../lib/vehicle-localization';

const baseVehicle = {
  id: 'vehicle-1',
  slug: 'mercedes-vito',
  name: 'Mercedes Vito',
  shortDescription: 'Türkçe kaynak açıklama',
  fullDescription: 'Türkçe uzun açıklama',
  passengerCapacity: 7,
  luggageCapacity: 7,
  vehicleType: 'MINIVAN',
  features: [
    { icon: 'CLIMATE', label: 'Klima' },
    { icon: 'WIFI', label: 'WiFi' },
    { icon: 'UNKNOWN', label: 'Türkçe özellik' },
  ],
  coverImage: '/images/mercedes-vito.jpg',
  coverImageAlt: 'Beyaz Mercedes Vito VIP transfer aracı',
  isFeatured: true,
  displayOrder: 1,
  nameTranslations: { tr: 'Mercedes Vito', de: 'Mercedes Vito' },
  shortDescTranslations: { tr: 'Türkçe kaynak açıklama', de: 'Deutsche Beschreibung' },
  taglineTranslations: { tr: 'Kompakt lüks', de: 'Kompakter Luxus' },
};

describe('resolvePublicVehicle', () => {
  it('uses only the requested non-Turkish translations', () => {
    const vehicle = resolvePublicVehicle(baseVehicle, 'de');

    expect(vehicle?.displayShortDesc).toBe('Deutsche Beschreibung');
    expect(vehicle?.coverImageAlt).toBe('Mercedes Vito');
    expect(vehicle?.features).toEqual([
      { icon: 'CLIMATE', label: 'Klima' },
      { icon: 'WIFI', label: 'WiFi' },
    ]);
  });

  it('withholds a card when a target-language field is missing', () => {
    const vehicle = resolvePublicVehicle({
      ...baseVehicle,
      taglineTranslations: { tr: 'Kompakt lüks' },
    }, 'de');

    expect(vehicle).toBeNull();
  });

  it('withholds a card rather than substituting a default cover image', () => {
    const vehicle = resolvePublicVehicle({ ...baseVehicle, coverImage: null }, 'tr');

    expect(vehicle).toBeNull();
  });

  it('keeps Turkish source fields available only for Turkish', () => {
    const vehicle = resolvePublicVehicle(baseVehicle, 'tr');

    expect(vehicle?.displayShortDesc).toBe('Türkçe kaynak açıklama');
    expect(vehicle?.features).toHaveLength(3);
  });

  it('excludes archived rows and incomplete non-Turkish cards from public endpoint output', () => {
    const resolved = resolvePublishedVehicles([
      { ...baseVehicle, status: 'PUBLISHED' },
      { ...baseVehicle, id: 'archived', slug: 'archived', status: 'ARCHIVED' },
      {
        ...baseVehicle, id: 'incomplete', slug: 'incomplete', status: 'PUBLISHED',
        taglineTranslations: { tr: 'Kompakt lüks' },
      },
    ], 'de');
    expect(resolved.map((vehicle) => vehicle.id)).toEqual(['vehicle-1']);
  });
});