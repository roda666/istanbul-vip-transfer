export const CANONICAL_SERVICE_TYPES = [
  'AIRPORT_TRANSFER',
  'INTERCITY',
  'ALLOCATION',
  'TOUR',
] as const;

export type CanonicalServiceType = typeof CANONICAL_SERVICE_TYPES[number];

export function isCanonicalServiceType(value: unknown): value is CanonicalServiceType {
  return typeof value === 'string'
    && (CANONICAL_SERVICE_TYPES as readonly string[]).includes(value);
}

/** Strict eligibility: an empty scope is never a wildcard. */
export function isServiceTypeInScope(scope: unknown, serviceType: unknown): serviceType is CanonicalServiceType {
  return isCanonicalServiceType(serviceType)
    && Array.isArray(scope)
    && scope.length > 0
    && scope.every(isCanonicalServiceType)
    && scope.includes(serviceType);
}

export function isCanonicalNonEmptyScope(scope: unknown): scope is CanonicalServiceType[] {
  return Array.isArray(scope) && scope.length > 0 && scope.every(isCanonicalServiceType);
}