import 'server-only';

import { resolveIntegrationSecret } from './integration-secrets';
import {
  googleGeocodingErrorMessage,
  parseGoogleGeocodingPayload,
  parseGoogleGeocodingResults,
  type LocationGeocodingResult,
} from './location-geocoding';

export class GoogleGeocodingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 422,
  ) {
    super(message);
    this.name = 'GoogleGeocodingError';
  }
}

export async function geocodeLocationAddress(address: string): Promise<LocationGeocodingResult> {
  const { response, payload } = await requestGoogleGeocoding(address);
  const result = parseGoogleGeocodingPayload(payload);
  if (response.ok && result) return result;
  throwGoogleGeocodingError(response, payload);
}

export async function searchLocationAddresses(address: string): Promise<LocationGeocodingResult[]> {
  const { response, payload } = await requestGoogleGeocoding(address);
  const results = parseGoogleGeocodingResults(payload, 5);
  if (response.ok && (payload.status === 'OK' || payload.status === 'ZERO_RESULTS')) return results;
  throwGoogleGeocodingError(response, payload);
}

async function requestGoogleGeocoding(address: string) {
  const apiKey = await resolveIntegrationSecret('GOOGLE_MAPS_API_KEY');
  if (!apiKey) {
    throw new GoogleGeocodingError(
      'NOT_CONFIGURED',
      'Google Maps API anahtarı yapılandırılmamış.',
      503,
    );
  }

  const params = new URLSearchParams({
    address,
    key: apiKey,
    language: 'tr',
    region: 'tr',
  });

  let response: Response;
  try {
    response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new GoogleGeocodingError(
      'NETWORK_ERROR',
      'Google Maps hizmetine bağlanılamadı.',
      503,
    );
  }

  let payload: {
    status?: string;
    error_message?: string;
    results?: Parameters<typeof parseGoogleGeocodingPayload>[0]['results'];
  };
  try {
    payload = await response.json();
  } catch {
    throw new GoogleGeocodingError(
      'INVALID_RESPONSE',
      'Google Maps geçersiz bir yanıt döndürdü.',
      502,
    );
  }

  return { response, payload };
}

function throwGoogleGeocodingError(
  response: Response,
  payload: { status?: string; error_message?: string },
): never {
  const code = payload.status || `HTTP_${response.status}`;
  const httpStatus = code === 'REQUEST_DENIED' ? 503 : code === 'UNKNOWN_ERROR' ? 502 : 422;
  throw new GoogleGeocodingError(code, googleGeocodingErrorMessage(payload.status), httpStatus);
}