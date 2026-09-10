export interface LocationGeocodingResult {
  formattedAddress: string;
  placeId: string;
  latitude: number;
  longitude: number;
  locationType: string;
  partialMatch: boolean;
}

interface GoogleGeocodingPayload {
  status?: string;
  error_message?: string;
  results?: Array<{
    formatted_address?: string;
    place_id?: string;
    partial_match?: boolean;
    geometry?: {
      location?: { lat?: number; lng?: number };
      location_type?: string;
    };
  }>;
}

export function parseGoogleGeocodingPayload(payload: GoogleGeocodingPayload): LocationGeocodingResult | null {
  return parseGoogleGeocodingResults(payload, 1)[0] ?? null;
}

export function parseGoogleGeocodingResults(
  payload: GoogleGeocodingPayload,
  limit = 5,
): LocationGeocodingResult[] {
  if (payload.status !== 'OK') return [];
  const results: LocationGeocodingResult[] = [];
  for (const item of payload.results ?? []) {
    const latitude = item.geometry?.location?.lat;
    const longitude = item.geometry?.location?.lng;
    if (!item.formatted_address || !item.place_id || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    results.push({
      formattedAddress: item.formatted_address,
      placeId: item.place_id,
      latitude: latitude!,
      longitude: longitude!,
      locationType: item.geometry?.location_type || 'UNKNOWN',
      partialMatch: item.partial_match === true,
    });
    if (results.length >= limit) break;
  }
  return results;
}

export function googleGeocodingErrorMessage(status: string | undefined): string {
  switch (status) {
    case 'ZERO_RESULTS':
      return 'Bu lokasyon için Google Maps sonucu bulunamadı.';
    case 'REQUEST_DENIED':
      return 'Google Maps erişimi reddedildi. Geocoding API etkinliğini ve API anahtarı kısıtlamalarını kontrol edin.';
    case 'OVER_DAILY_LIMIT':
    case 'OVER_QUERY_LIMIT':
      return 'Google Maps kullanım kotası aşıldı veya faturalandırma yapılandırması eksik.';
    case 'INVALID_REQUEST':
      return 'Google Maps sorgusu geçersiz. Lokasyon adı, şehir ve ilçe bilgilerini kontrol edin.';
    case 'UNKNOWN_ERROR':
      return 'Google Maps geçici bir hata döndürdü. Bir süre sonra tekrar deneyin.';
    default:
      return 'Google Maps hizmetinden geçerli bir sonuç alınamadı.';
  }
}

export function applyGeocodingResultToForm<
  T extends {
    latitude: string;
    longitude: string;
    coordinateSource: string;
    coordinateAccuracyMeters: string;
  },
>(form: T, result: LocationGeocodingResult): T {
  return {
    ...form,
    latitude: String(result.latitude),
    longitude: String(result.longitude),
    coordinateSource: 'Google Maps (otomatik)',
    // Geocoding location_type is not a reliable metre measurement. Avoid
    // retaining an accuracy value that belonged to older coordinates.
    coordinateAccuracyMeters: '',
  };
}