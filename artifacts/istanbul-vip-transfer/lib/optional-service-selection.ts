import { normalizeFlightMeetGreetKey } from '@/lib/flight-meet-greet-contract';

type ServiceIdentity = {
  id: string;
  key: string;
  displayOrder?: number | null;
  createdAt?: Date | string | null;
};

/** Deterministically keep one row per semantic service key. */
export function dedupeOptionalServices<T extends ServiceIdentity>(services: T[]): T[] {
  const winners = new Map<string, T>();
  const rank = (service: T) => [
    normalizeFlightMeetGreetKey(service.key) === 'flight-meet-greet' && service.key === 'flight-meet-greet' ? 0 : 1,
    service.displayOrder ?? Number.MAX_SAFE_INTEGER,
    service.createdAt ? new Date(service.createdAt).getTime() : Number.MAX_SAFE_INTEGER,
    service.id,
  ] as [number, number, number, string];
  const before = (left: T, right: T) => {
    const a = rank(left);
    const b = rank(right);
    for (let index = 0; index < a.length; index += 1) {
      if (a[index] === b[index]) continue;
      return index < 3
        ? (a[index] as number) < (b[index] as number)
        : (a[index] as string).localeCompare(b[index] as string) < 0;
    }
    return false;
  };
  for (const service of services) {
    const key = normalizeFlightMeetGreetKey(service.key);
    const current = winners.get(key);
    if (!current || before(service, current)) {
      winners.set(key, service);
    }
  }
  return [...winners.values()];
}