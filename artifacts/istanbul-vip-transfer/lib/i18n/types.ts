/**
 * Dictionary interface — covers all UI text that needs translation.
 * Content (articles, service descriptions) is translated via the DB translation system.
 * This covers static chrome: header, footer, booking form, navigation, common UI.
 */
export interface Dictionary {
  header: {
    whatsappCta: string;
    allServices: string;
    menuOpen: string;
    menuClose: string;
    desktopNav: string;
    mobileMenu: string;
    servicesSubmenu: string;
    servicesSubmenuToggle: string;
  };
  footer: {
    quickLinks: string;
    services: string;
    contact: string;
    available247: string;
    copyright: string;
    premium: string;
    allServices: string;
    homeLink: string;
    servicesLink: string;
    vehiclesLink: string;
    blogLink: string;
    aboutLink: string;
    reservationLink: string;
    contactLink: string;
  };
  common: {
    loading: string;
    error: string;
    notFound: string;
    dbError: string;
    back: string;
    learnMore: string;
    contactUs: string;
    readMore: string;
    viewAll: string;
    send: string;
    save: string;
    cancel: string;
  };
  booking: {
    sectionLabel: string;
    sectionTitle: string;
    sectionDescription: string;
    intentLabel: string;
    intentQuote: string;
    intentReservation: string;
    serviceTypeLabel: string;
    // Location fields
    pickupLocation: string;
    dropoffLocation: string;
    pickupAddress: string;
    dropoffAddress: string;
    optional: string;
    flightNumber: string;
    departureCity: string;
    arrivalCity: string;
    departureAddress: string;
    arrivalAddress: string;
    direction: string;
    oneWay: string;
    roundTrip: string;
    returnDate: string;
    returnTime: string;
    allocationLocation: string;
    allocationDuration: string;
    allocationHours: string;
    allocationDays: string;
    routeDescription: string;
    tourRoute: string;
    tourPlaces: string;
    plannedDuration: string;
    // Common form fields
    date: string;
    time: string;
    passengerCount: string;
    fullName: string;
    phone: string;
    notes: string;
    // Submit
    submitQuote: string;
    submitReservation: string;
    // Placeholders
    pickupPlaceholder: string;
    dropoffPlaceholder: string;
    pickupAddressPlaceholder: string;
    dropoffAddressPlaceholder: string;
    flightPlaceholder: string;
    departureCityPlaceholder: string;
    arrivalCityPlaceholder: string;
    departureCityAddressPlaceholder: string;
    arrivalCityAddressPlaceholder: string;
    // Validation
    requiredDate: string;
    requiredHour: string;
    requiredMinute: string;
    requiredPassengers: string;
    requiredName: string;
    requiredPhone: string;
    requiredPickup: string;
    requiredDropoff: string;
    sameLocationError: string;
    requiredDeparture: string;
    requiredArrival: string;
    sameProvinceError: string;
    requiredReturnDate: string;
    requiredAllocationLocation: string;
    requiredDuration: string;
    requiredTourRoute: string;
    minuteMultipleError: string;
    // WhatsApp message labels
    waRequestType: string;
    waService: string;
    waPickup: string;
    waPickupAddress: string;
    waDropoff: string;
    waDropoffAddress: string;
    waFlightNumber: string;
    waDate: string;
    waTime: string;
    waDepartureCity: string;
    waDepartureAddress: string;
    waArrivalCity: string;
    waArrivalAddress: string;
    waDirection: string;
    waOneWay: string;
    waRoundTrip: string;
    waDepartureDate: string;
    waDepartureTime: string;
    waReturnDate: string;
    waReturnTime: string;
    waStartDate: string;
    waStartTime: string;
    waDuration: string;
    waRouteDescription: string;
    waTourRoute: string;
    waTourPlaces: string;
    waPlannedDuration: string;
    waPassengers: string;
    waFullName: string;
    waPhone: string;
    waNotes: string;
    waQuote: string;
    waReservation: string;
    waHours: string;
    waDays: string;
  };
  langSelector: {
    label: string;
    ariaLabel: string;
    currentLang: string;
  };
  nav: {
    services: string;
    vehicles: string;
    blog: string;
    about: string;
    contact: string;
    booking: string;
  };
}
