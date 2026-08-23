import { z } from 'zod';

export const FLIGHT_PROVIDER_NONE = 'NONE';

export type FlightLookupInput = {
  flightNumber: string;
  flightDate: string;
};

export type FlightLookupSuccess = {
  status: 'AVAILABLE';
  flightNumber: string;
  flightDate: string;
  airlineName: string | null;
  arrivalAirportIata: string | null;
  scheduledArrival: string | null;
  estimatedArrival: string | null;
  flightStatus: 'SCHEDULED' | 'DELAYED' | 'LANDED' | 'CANCELLED' | 'UNKNOWN';
};

/**
 * Future provider adapters implement this on the server only. The contract
 * deliberately excludes request headers, API keys, raw provider payloads and
 * provider-specific error messages.
 */
export interface FlightInformationProvider {
  readonly id: string;
  lookup(input: FlightLookupInput): Promise<FlightLookupSuccess>;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export const flightLookupInputSchema = z.object({
  flightNumber: z.string()
    .trim()
    .min(3)
    .max(8)
    .transform((value) => value.toUpperCase().replace(/[\s-]/g, ''))
    .refine((value) => /^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(value), {
      message: 'Geçerli bir uçuş numarası girin.',
    }),
  flightDate: z.string().trim().refine(isCalendarDate, {
    message: 'Geçerli bir uçuş tarihi girin.',
  }),
});

export type FlightLookupResult =
  | { state: 'DISABLED' }
  | { state: 'PROVIDER_NOT_CONFIGURED' }
  | { state: 'NOT_FOUND' }
  | { state: 'AVAILABLE'; flight: FlightLookupSuccess };

export type FlightMeetGreetStatus = {
  enabled: boolean;
  provider: {
    id: string;
    label: string;
    configured: boolean;
  };
  lookupReady: boolean;
};

/**
 * Converts the persisted provider key to a safe status object. No credential
 * name, value, provider error, or raw provider response reaches the client.
 */
export function createFlightMeetGreetStatus(
  settings?: { enabled?: boolean | null; providerId?: string | null } | null,
): FlightMeetGreetStatus {
  const providerId = settings?.providerId?.trim() || FLIGHT_PROVIDER_NONE;
  const configured = false;
  const label = providerId === FLIGHT_PROVIDER_NONE
    ? 'Sağlayıcı yapılandırılmadı'
    : 'Sağlayıcı henüz kullanıma hazır değil';

  return {
    enabled: settings?.enabled === true,
    provider: { id: providerId, label, configured },
    lookupReady: false,
  };
}