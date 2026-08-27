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
    tagline: string;
    locationCity: string;
    locationServing: string;
    legalTitle: string;
    cookieLink: string;
    termsLink: string;
    privacyLink: string;
    // Trust & payment section
    tursabLabel: string;
    paymentMethods: string;
    cashPayment: string;
    bankTransfer: string;
    googlePlayLabel: string;
    googleBusinessLink: string;
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
    whatsappAria: string;
    cookieBannerText: string;
    cookieBannerAccept: string;
    cookieBannerDetails: string;
  };
  relatedBlog: {
    heading: string;
    guideLabel: string;
    comparisonLabel: string;
    airportGuideDescription: string;
    comparisonDescription: string;
    istanbulDestinationDescription: string;
    sabihaDestinationDescription: string;
    istanbulAirportGuideTitle: string;
    sabihaAirportGuideTitle: string;
    vipVsTaxiTitle: string;
  };
  booking: {
    sectionLabel: string;
    sectionTitle: string;
    sectionDescription: string;
    serviceTypeLabel: string;
    // Location fields
    pickupLocation: string;
    dropoffLocation: string;
    pickupAddress: string;
    dropoffAddress: string;
    optional: string;
    departureCity: string;
    arrivalCity: string;
    departureAddress: string;
    arrivalAddress: string;
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
    email: string;
    newsletterConsent: string;
    newsletterEmailRequired: string;
    minAllocationDuration: string;
    // Submit
    submitQuote: string;
    submitReservation: string;
    // Panel labels
    routeFieldsLabel: string;
    allocationFieldsLabel: string;
    tourFieldsLabel: string;
    datetimePanel: string;
    startPanel: string;
    contactPanel: string;
    // Hints and notices
    vehicleHint: string;
    importantLabel: string;
    importantNotice: string;
    submittingLabel: string;
    submitButton: string;
    directMessage: string;
    kvkkLink: string;
    commercialLink: string;
    // Time abbr
    hourAbbr: string;
    minuteAbbr: string;
    // WhatsApp message
    waHeading: string;
    passengerSuffix: string;
    // Placeholders
    pickupPlaceholder: string;
    dropoffPlaceholder: string;
    pickupAddressPlaceholder: string;
    dropoffAddressPlaceholder: string;
    departureCityPlaceholder: string;
    arrivalCityPlaceholder: string;
    departureCityAddressPlaceholder: string;
    arrivalCityAddressPlaceholder: string;
    allocationAddressPlaceholder: string;
    allocationRoutePlaceholder: string;
    tourPickupPlaceholder: string;
    tourAddressPlaceholder: string;
    tourRoutePlaceholder: string;
    tourPlacesPlaceholder: string;
    namePlaceholder: string;
    phonePlaceholder: string;
    emailPlaceholder: string;
    // Aria labels
    allocationDurationAmountLabel: string;
    allocationDurationUnitLabel: string;
    plannedDurationAmountLabel: string;
    plannedDurationUnitLabel: string;
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
    requiredAllocationLocation: string;
    requiredDuration: string;
    requiredTourRoute: string;
    minuteMultipleError: string;
    // Service type card labels (used by BookingForm; DB labels are always Turkish)
    stAirportTransfer: string;
    stIntercity: string;
    stAllocation: string;
    stTour: string;
    // WhatsApp message labels
    waRequestType: string;
    waService: string;
    waPickup: string;
    waPickupAddress: string;
    waDropoff: string;
    waDropoffAddress: string;
    waDate: string;
    waTime: string;
    waDepartureCity: string;
    waDepartureAddress: string;
    waArrivalCity: string;
    waArrivalAddress: string;
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
    waEmail: string;
    waReference: string;
    waQuote: string;
    waReservation: string;
    waHours: string;
    waDays: string;
    // Collapsible booking section (used by CollapsibleBookingForm on service/blog pages)
    expand?: string;
    collapse?: string;
    // Optional admin-configured booking fields
    luggageCount: string;
    luggageCountPlaceholder: string;
    childSeatCount?: string;
    childSeatCountPlaceholder?: string;
    vehiclePreference?: string;
    vehiclePreferenceDefault?: string;
    additionalNotes?: string;
    additionalNotesPlaceholder?: string;
    waLuggageCount?: string;
    waChildSeatCount?: string;
    waVehiclePreference?: string;
    waAdditionalNotes?: string;
    // Flight number / trip direction (airport & intercity transfers)
    flightNumber: string;
    flightNumberPlaceholder: string;
    tripDirection: string;
    tripOneWay: string;
    tripRoundTrip: string;
    waFlightNumber: string;
    waTripDirection: string;
    // Closing WhatsApp message line confirming the request was also saved
    waSavedNotice: string;
  };
  langSelector: {
    label: string;
    ariaLabel: string;
    currentLang: string;
  };
  nav: {
    home: string;
    services: string;
    vehicles: string;
    blog: string;
    about: string;
    contact: string;
    booking: string;
    // Service submenu group labels
    groupAirport: string;
    groupSpecial: string;
    groupRoutes: string;
    groupTours: string;
    // Service item labels
    istTransfer: string;
    sawTransfer: string;
    vipTransfer: string;
    intercityTransfer: string;
    chauffeur: string;
    hotelTransfer: string;
    healthTransfer: string;
    corporateTransfer: string;
    istBursaRoute: string;
    istSapancaRoute: string;
    istDayTours: string;
    sapancaTour: string;
    bursaTour: string;
    yalovaTour: string;
    weddingCarRental: string;
    dailyVillaRental: string;
    meetGreetService: string;
    vipProtocolVehicle: string;
  };
  hero: {
    badge: string;
    headline1: string;
    headlineAccent: string;
    headline2: string;
    subheadline: string;
    ctaBooking: string;
    ctaCall: string;
    trustAirportLabel: string;
    trustSupportLabel: string;
    trustVehiclesLabel: string;
    scrollHint: string;
    scrollAriaLabel: string;
    imageAlt: string;
  };
  services: {
    sectionLabel: string;
    heading: string;
    subheading: string;
    detailsLink: string;
  };
  trust: {
    sectionLabel: string;
    heading: string;
    stat247Label: string;
    stat247Desc: string;
    statAirportLabel: string;
    statAirportDesc: string;
    statVehiclesLabel: string;
    statVehiclesDesc: string;
    statMeetLabel: string;
    statMeetDesc: string;
  };
  vehicles: {
    sectionLabel: string;
    heading: string;
    subheading: string;
    passengers: string;
    luggage: string;
    popular: string;
    cta: string;
    vitoTagline: string;
    vitoAlt: string;
    vitoDesc: string;
    sprinterTagline: string;
    sprinterAlt: string;
    sprinterDesc: string;
    featureClimate: string;
    featureLeather: string;
    featureLuxury: string;
    featureWater: string;
  };
  reviews: {
    sectionLabel: string;
    heading: string;
    viewAll: string;
  };
  contact: {
    sectionLabel: string;
    heading: string;
    subheading: string;
    supportLine: string;
    whatsappCta: string;
    phoneTitle: string;
    hoursTitle: string;
    hoursValue: string;
    hoursAlways: string;
    emailTitle: string;
    emailSub: string;
    regionTitle: string;
    regionValue: string;
    regionSub: string;
  };
  faq: {
    sectionLabel: string;
    heading: string;
  };
  /** Static page-intro strings for hizmetler / araclar / hakkimizda / iletisim,
   *  plus all service/tour pages. Resolved inside PageHero via useLang() when a
   *  pageKey prop is supplied, allowing Server-Component pages to remain locale-neutral. */
  pages: {
    // General pages
    servicesTitle: string;
    servicesSubtitle: string;
    vehiclesTitle: string;
    vehiclesSubtitle: string;
    aboutTitle: string;
    aboutSubtitle: string;
    contactTitle: string;
    contactSubtitle: string;
    // Istanbul Airport Transfer
    istHavaTitle: string;
    istHavaSubtitle: string;
    istHavaCrumb: string;
    // Sabiha Gökçen Airport Transfer
    sabihaTitle: string;
    sabihaSubtitle: string;
    sabihaCrumb: string;
    // VIP Transfer (general)
    vipTransferTitle: string;
    vipTransferSubtitle: string;
    vipTransferCrumb: string;
    // Intercity Transfer
    sehirlerArasiTitle: string;
    sehirlerArasiSubtitle: string;
    sehirlerArasiCrumb: string;
    // Chauffeured Vehicle Hire
    soforluTitle: string;
    soforluSubtitle: string;
    soforluCrumb: string;
    // Hotel Transfer
    otelTitle: string;
    otelSubtitle: string;
    otelCrumb: string;
    // Medical Tourism Transfer
    saglikTitle: string;
    saglikSubtitle: string;
    saglikCrumb: string;
    // Corporate VIP Transfer
    kurumsalTitle: string;
    kurumsalSubtitle: string;
    kurumsalCrumb: string;
    // Istanbul–Bursa Transfer
    istBursaTitle: string;
    istBursaSubtitle: string;
    istBursaCrumb: string;
    // Istanbul–Sapanca Transfer
    istSapancaTitle: string;
    istSapancaSubtitle: string;
    istSapancaCrumb: string;
    // Istanbul Day Tours
    istGunubirlikTitle: string;
    istGunubirlikSubtitle: string;
    istGunubirlikCrumb: string;
    // Sapanca–Maşukiye Day Tour
    sapancaTitle: string;
    sapancaSubtitle: string;
    sapancaCrumb: string;
    // Bursa Day Tour
    bursaTitle: string;
    bursaSubtitle: string;
    bursaCrumb: string;
    // Yalova Day Tour
    yalovaTitle: string;
    yalovaSubtitle: string;
    yalovaCrumb: string;
  };
  routes: {
    sectionLabel: string;
    heading: string;
    subheading: string;
    distance: string;
    duration: string;
    vito: string;
    sprinter: string;
    priceFrom: string;
    km: string;
    min: string;
    h: string;
    bookBtn: string;
  };
  chatbot: {
    /** Floating button aria label */
    aria: string;
    /** Panel header title */
    title: string;
    /** Welcome message shown before first user message */
    welcome: string;
    /** Input placeholder */
    placeholder: string;
    /** Send button label */
    send: string;
    /** Close panel button aria label */
    close: string;
    /** Typing indicator text */
    typing: string;
    /** Error message when request fails */
    error: string;
  };
  /** General contact enquiry form on the İletişim page (not the booking/quote form). */
  contactForm: {
    sectionLabel: string;
    heading: string;
    subheading: string;
    nameLabel: string;
    emailLabel: string;
    phoneLabel: string;
    phoneOptional: string;
    subjectLabel: string;
    messageLabel: string;
    namePlaceholder: string;
    emailPlaceholder: string;
    phonePlaceholder: string;
    subjectPlaceholder: string;
    messagePlaceholder: string;
    submitButton: string;
    submitting: string;
    successTitle: string;
    successMessage: string;
    errorMessage: string;
    requiredName: string;
    requiredEmail: string;
    requiredSubject: string;
    requiredMessage: string;
    invalidEmail: string;
    rateLimit: string;
    minMessage: string;
    newsletterConsent: string;
    kvkkLink: string;
    commercialLink: string;
  };
  servicePricing: {
    /** Template string with a literal "{price}" placeholder for the EUR amount. */
    startingFrom: string;
  };
}
