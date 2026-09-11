export const OPTIONAL_SERVICE_CURRENCIES = ['TRY', 'EUR', 'USD'] as const;
export const OPTIONAL_SERVICE_CHARGE_TYPES = ['PER_BOOKING', 'PER_PERSON'] as const;
type OptionalServiceValidityInput = {
  unitAmount: unknown;
  currency: unknown;
  chargeType: unknown;
  maximumQuantity: unknown;
};

/** Runtime guard for legacy rows as well as newly-written catalog records. */
export function isOptionalServiceRuntimeValid(service: OptionalServiceValidityInput): boolean {
  return Number.isSafeInteger(service.unitAmount) && (service.unitAmount as number) > 0
    && OPTIONAL_SERVICE_CURRENCIES.includes(service.currency as typeof OPTIONAL_SERVICE_CURRENCIES[number])
    && OPTIONAL_SERVICE_CHARGE_TYPES.includes(service.chargeType as typeof OPTIONAL_SERVICE_CHARGE_TYPES[number])
    && Number.isSafeInteger(service.maximumQuantity) && (service.maximumQuantity as number) >= 1
    && (service.chargeType !== 'PER_BOOKING' || service.maximumQuantity === 1);
}

export function assertOptionalServiceRuntimeValid(service: OptionalServiceValidityInput): void {
  if (!isOptionalServiceRuntimeValid(service)) {
    throw new Error('Ek hizmet katalog kaydı geçersiz (tutar, para birimi, ücret tipi veya azami adet).');
  }
}