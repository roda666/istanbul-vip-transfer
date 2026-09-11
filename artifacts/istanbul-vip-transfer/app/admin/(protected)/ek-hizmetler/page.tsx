import { permanentRedirect } from 'next/navigation';

/** Compatibility URL: the catalog now lives as a pricing-workspace tab. */
export default function OptionalServicesPage() {
  permanentRedirect('/admin/fiyat-kurallari?tab=ek-hizmetler');
}