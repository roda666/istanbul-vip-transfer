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
  if (payload.status !== 'OK') return null;
  const first = payload.results?.[0];
  const latitude = first?.geometry?.location?.lat;
  const longitude = first?.geometry?.location?.lng;
  if (!first?.formatted_address || !first.place_id || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    formattedAddress: first.formatted_address,
    placeId: first.place_id,
    latitude: latitude!,
    longitude: longitude!,
    locationType: first.geometry?.location_type || 'UNKNOWN',
    partialMatch: first.partial_match === true,
  };
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