export interface BookingServiceTypeOption {
  id: string;
  key: string;
  label: string;
  description: string | null;
  quoteEnabled: boolean;
  reservationEnabled: boolean;
}

export interface BookingVehicleOption {
  id: string;
  slug: string;
  displayName: string;
  passengerCapacity: number | null;
  vehicleType: string | null;
}

export interface BookingLocationOption {
  id: string;
  name: string;
  slug: string;
  type: 'AIRPORT' | 'DISTRICT' | 'REGION' | 'HOTEL_ZONE' | 'CUSTOM' | 'PROVINCE';
  scope: 'LOCAL' | 'INTERCITY' | 'BOTH';
  city: string;
  district: string | null;
}

export interface BookingCustomField {
  id: number;
  label: string;
  appliesToSlugs: string[];
  fieldType: string;
  isActive: boolean;
  sortOrder: number;
}

export interface BookingFormBootstrap {
  serviceTypes: BookingServiceTypeOption[];
  vehicles: BookingVehicleOption[];
  formSettings: {
    showVehiclePreference: boolean;
  };
  customFields: BookingCustomField[];
  locations: {
    localPickup: BookingLocationOption[];
    localDropoff: BookingLocationOption[];
    intercityPickup: BookingLocationOption[];
    intercityDropoff: BookingLocationOption[];
  };
}

export const FALLBACK_BOOKING_SERVICE_TYPES: BookingServiceTypeOption[] = [
  { id: '1', key: 'AIRPORT_TRANSFER', label: 'Havalimanı / Şehir İçi Transfer', description: null, quoteEnabled: true, reservationEnabled: true },
  { id: '2', key: 'INTERCITY', label: 'Şehirler Arası Transfer', description: null, quoteEnabled: true, reservationEnabled: true },
  { id: '3', key: 'ALLOCATION', label: 'Araç Tahsisi', description: null, quoteEnabled: true, reservationEnabled: true },
  { id: '4', key: 'TOUR', label: 'Özel Tur / Gezi', description: null, quoteEnabled: true, reservationEnabled: true },
];

export const EMPTY_BOOKING_FORM_BOOTSTRAP: BookingFormBootstrap = {
  serviceTypes: FALLBACK_BOOKING_SERVICE_TYPES,
  vehicles: [],
  formSettings: { showVehiclePreference: false },
  customFields: [],
  locations: {
    localPickup: [],
    localDropoff: [],
    intercityPickup: [],
    intercityDropoff: [],
  },
};