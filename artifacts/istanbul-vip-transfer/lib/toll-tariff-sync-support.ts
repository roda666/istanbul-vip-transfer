export const AVRASYA_TARIFF_URL = 'https://www.avrasyatuneli.com/ucretlendirme/';

export function isAutomaticTollSyncSupported(identity: {
  sourceUrl: string | null;
  vehicleClass: string;
  timeBand: string;
}): boolean {
  return identity.sourceUrl === AVRASYA_TARIFF_URL
    && (identity.timeBand === 'DAY' || identity.timeBand === 'NIGHT')
    && ['class_1', 'class_2', 'class_6'].includes(identity.vehicleClass);
}