export type MatchableLocation = {
  id: string;
  name: string;
};

export function canonicalLocationName(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/[ığüşöç]/g, (character) => ({
      ı: 'i', ğ: 'g', ü: 'u', ş: 's', ö: 'o', ç: 'c',
    })[character]!)
    .replace(/\((?:ist|saw)\)/g, ' ')
    .replace(/\bmeydani\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function matchRouteEndpointToLocation<T extends MatchableLocation>(
  endpoint: string,
  locations: T[],
): T | null {
  // A slash represents multiple possible destinations in the legacy route
  // catalogue. Never choose one arbitrarily.
  if (endpoint.includes('/')) return null;
  const target = canonicalLocationName(endpoint);
  if (!target) return null;
  const matches = locations.filter((location) => canonicalLocationName(location.name) === target);
  return matches.length === 1 ? matches[0] : null;
}