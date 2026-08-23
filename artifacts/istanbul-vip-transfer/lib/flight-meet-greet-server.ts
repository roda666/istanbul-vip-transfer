import 'server-only';

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { flightMeetGreetSettings } from '@/db/schema';
import {
  createFlightMeetGreetStatus,
  FLIGHT_PROVIDER_NONE,
  type FlightInformationProvider,
  type FlightLookupInput,
  type FlightLookupResult,
  type FlightMeetGreetStatus,
} from '@/lib/flight-meet-greet-contract';

/**
 * Provider registry intentionally starts empty. Add a server-only adapter here
 * only after a provider contract and its secret have been approved.
 */
const providerRegistry = new Map<string, FlightInformationProvider>();

export async function getFlightMeetGreetStatus(): Promise<FlightMeetGreetStatus> {
  const rows = await db
    .select({
      enabled: flightMeetGreetSettings.enabled,
      providerId: flightMeetGreetSettings.providerId,
    })
    .from(flightMeetGreetSettings)
    .where(eq(flightMeetGreetSettings.id, 1))
    .limit(1);
  return createFlightMeetGreetStatus(rows[0]);
}

/** Missing settings rows are always treated as closed. */
export async function isFlightMeetGreetEnabled(): Promise<boolean> {
  return (await getFlightMeetGreetStatus()).enabled;
}

/**
 * Looks up flight information only after the feature flag and provider
 * configuration are both valid. With the initial NONE provider this never
 * calls a third party service.
 */
export async function lookupFlightInformation(input: FlightLookupInput): Promise<FlightLookupResult> {
  const status = await getFlightMeetGreetStatus();
  if (!status.enabled) return { state: 'DISABLED' };
  if (!status.provider.configured || status.provider.id === FLIGHT_PROVIDER_NONE) {
    return { state: 'PROVIDER_NOT_CONFIGURED' };
  }

  const provider = providerRegistry.get(status.provider.id);
  if (!provider) return { state: 'PROVIDER_NOT_CONFIGURED' };

  try {
    return { state: 'AVAILABLE', flight: await provider.lookup(input) };
  } catch {
    // Provider failures deliberately stay generic; callers never receive
    // implementation, account, credential, or raw upstream-response details.
    return { state: 'NOT_FOUND' };
  }
}