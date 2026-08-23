/**
 * Brand data is intentionally conservative for vehicle JSON-LD. It is derived
 * only from authoritative model names, never image filenames or vehicle class.
 */
export function resolveVehicleBrand(name: string): { '@type': 'Brand'; name: string } | undefined {
  if (/^Mercedes\b/i.test(name)) return { '@type': 'Brand', name: 'Mercedes-Benz' };
  if (/^Volkswagen\b/i.test(name)) return { '@type': 'Brand', name: 'Volkswagen' };
  return undefined;
}