'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
// framer-motion removed from this file — animations handled via CSS keyframes
// in globals.css (.ivt-booking-header / .ivt-booking-card) to avoid the
// SSR → client inline-style hydration mismatch that motion.div/whileInView
// caused (server writes opacity:0 as an inline style; client reconciler sees
// a different attribute representation and warns).
import {
  MapPin, Calendar, Clock, Users, User, Phone, Home,
  Plane, ArrowRightLeft, Car, Compass, Mail, Briefcase,
} from 'lucide-react';
import LocationCombobox, { type LocationOption } from './LocationCombobox';
import { useLang } from '@/lib/i18n/context';
import { formatServiceDate } from '@/lib/booking-date';
import {
  isFiveMinuteIncrement,
  isValidPassengerCount,
  findSmallestFittingVehicle,
  meetsAllocationMinimum,
  MIN_ALLOCATION_HOURS,
} from '@/lib/booking-rules';
import { isolateLtrValues } from '@/lib/i18n/bidi';
import { getPublicUiCopy } from '@/lib/i18n/public-ui';
import { localizedPublicPath } from '@/lib/localized-service-path';
import { useHomepageCms } from '@/lib/homepage-cms-context';
import {
  formatPhoneForWhatsAppMessage,
  formatWhatsAppLabel,
  openWhatsAppChat,
} from '@/lib/whatsapp';
import { SITE } from '@/lib/site-config';
import { useBookingFormData } from './BookingFormDataContext';
import type {
  BookingCustomField as CustomField,
  BookingServiceTypeOption as ServiceTypeOption,
  BookingVehicleOption as PublishedVehicleOption,
} from '@/lib/booking-form-types';

// ── Constants ─────────────────────────────────────────────────────────────────

// Visually-hidden (not off-screen) so the field never inflates document scrollWidth.
// tabIndex={-1} already removes it from keyboard/AT navigation.
const HONEYPOT_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
  opacity: 0,
};
const RESERVATION_SUBMISSION_ATTEMPTS = 3;
const RESERVATION_RETRY_DELAYS_MS = [0, 500, 1_500] as const;
const RESERVATION_REQUEST_TIMEOUT_MS = 20_000;
const SUBMISSION_STATUS_COPY: Record<string, { saved: string; failed: string }> = {
  tr: {
    saved: 'Talebiniz sisteme kaydedildi. WhatsApp mesajını göndererek görüşmeyi başlatabilirsiniz.',
    failed: 'WhatsApp açıldı ancak talebiniz sisteme kaydedilemedi. Lütfen WhatsApp mesajını mutlaka gönderin veya formu tekrar deneyin.',
  },
  en: {
    saved: 'Your request was saved. Send the WhatsApp message to start the conversation.',
    failed: 'WhatsApp opened, but your request could not be saved. Please send the WhatsApp message or try the form again.',
  },
  de: {
    saved: 'Ihre Anfrage wurde gespeichert. Senden Sie die WhatsApp-Nachricht, um das Gespräch zu beginnen.',
    failed: 'WhatsApp wurde geöffnet, aber Ihre Anfrage konnte nicht gespeichert werden. Bitte senden Sie die WhatsApp-Nachricht oder versuchen Sie es erneut.',
  },
  ru: {
    saved: 'Ваш запрос сохранён. Отправьте сообщение WhatsApp, чтобы начать общение.',
    failed: 'WhatsApp открылся, но запрос не удалось сохранить. Отправьте сообщение WhatsApp или повторите попытку.',
  },
  ar: {
    saved: 'تم حفظ طلبك. أرسل رسالة واتساب لبدء المحادثة.',
    failed: 'تم فتح واتساب، لكن تعذر حفظ طلبك. يرجى إرسال رسالة واتساب أو إعادة المحاولة.',
  },
  fr: {
    saved: 'Votre demande a été enregistrée. Envoyez le message WhatsApp pour démarrer la conversation.',
    failed: 'WhatsApp s’est ouvert, mais votre demande n’a pas pu être enregistrée. Envoyez le message WhatsApp ou réessayez.',
  },
  es: {
    saved: 'Tu solicitud se guardó. Envía el mensaje de WhatsApp para iniciar la conversación.',
    failed: 'WhatsApp se abrió, pero no se pudo guardar tu solicitud. Envía el mensaje de WhatsApp o inténtalo de nuevo.',
  },
  it: {
    saved: 'La richiesta è stata salvata. Invia il messaggio WhatsApp per iniziare la conversazione.',
    failed: 'WhatsApp si è aperto, ma la richiesta non è stata salvata. Invia il messaggio WhatsApp o riprova.',
  },
  nl: {
    saved: 'Uw aanvraag is opgeslagen. Verstuur het WhatsApp-bericht om het gesprek te starten.',
    failed: 'WhatsApp is geopend, maar uw aanvraag kon niet worden opgeslagen. Verstuur het WhatsApp-bericht of probeer het opnieuw.',
  },
};

interface CustomFieldAnswer {
  id: number;
  label: string;
  value: boolean | string;
}

// ── Service type defs ─────────────────────────────────────────────────────────

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  AIRPORT_TRANSFER: <Plane        size={20} aria-hidden="true" />,
  INTERCITY:        <ArrowRightLeft size={20} aria-hidden="true" />,
  ALLOCATION:       <Car           size={20} aria-hidden="true" />,
  TOUR:             <Compass       size={20} aria-hidden="true" />,
};

const SERVICE_ICON_COLORS: Record<string, string> = {
  AIRPORT_TRANSFER: '#2563EB',
  INTERCITY:        '#7C3AED',
  ALLOCATION:       '#C79A35',
  TOUR:             '#2563EB',
};

const HIZMET_MAP: Record<string, string> = {
  'havaalani':      'AIRPORT_TRANSFER',
  'sehirler-arasi': 'INTERCITY',
  'arac-tahsisi':   'ALLOCATION',
  'tur':            'TOUR',
};

// ── Form schema (built with translated messages) ──────────────────────────────

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

function buildSchema(b: import('@/lib/i18n/types').Dictionary['booking']) {
  return z.object({
    tarih:      z.string().min(1, b.requiredDate),
    saatSaat:   z.string().min(1, b.requiredHour),
    saatDakika: z.string().min(1, b.requiredMinute)
      .refine(isFiveMinuteIncrement, { message: b.minuteMultipleError }),
    yolcuSayisi: z.string()
      .min(1, b.requiredPassengers)
      .refine((value) => {
        return isValidPassengerCount(value);
      }, { message: b.requiredPassengers }),
    adSoyad:     z.string().min(2, b.requiredName),
    telefon:     z.string().min(10, b.requiredPhone),
    email:       z.string().optional(),

    // AIRPORT_TRANSFER
    alisLokasyonu:  z.string().optional(),
    alisAdresi:     z.string().optional(),
    varisLokasyonu: z.string().optional(),
    varisAdresi:    z.string().optional(),
    ucusNumarasi:   z.string().optional(),

    // AIRPORT_TRANSFER + INTERCITY
    bagajSayisi: z.string().optional(),
    seyahatYonu: z.enum(['GIDIS', 'GIDIS_DONUS']).optional(),

    // INTERCITY
    kalkisIli:   z.string().optional(),
    kalkisAdres: z.string().optional(),
    varisIli:    z.string().optional(),
    varisAdres:  z.string().optional(),

    // ALLOCATION
    tahsisSuresi:     z.string().optional(),
    tahsisSuresiUnit: z.enum(['SAAT', 'GUN']).default('SAAT'),
    rotaAciklama:     z.string().optional(),

    // TOUR
    talepsRota:        z.string().optional(),
    talepsYerler:      z.string().optional(),
    planlananSure:     z.string().optional(),
    planlananSureUnit: z.enum(['SAAT', 'GUN']).default('SAAT'),
    vehiclePreference: z.string().optional(),
  });
}

type FormData = z.infer<ReturnType<typeof buildSchema>>;

// ── Style tokens ──────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display:       'flex',
  alignItems:    'center',
  gap:           '6px',
  fontSize:      '11px',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  marginBottom:  '10px',
  fontWeight:    700,
  color:         '#263F55',
  fontFamily:    'Inter, sans-serif',
};

const errorStyle: React.CSSProperties = {
  marginTop:  '6px',
  fontSize:   '12px',
  color:      '#DC2626',
  fontFamily: 'Inter, sans-serif',
};

const hintStyle: React.CSSProperties = {
  marginTop:  '4px',
  fontSize:   '11px',
  color:      '#4E6275', // ≥4.5:1 on white — WCAG AA compliant (was #718596 ≈3.4:1)
  fontFamily: 'Inter, sans-serif',
};

// Alternating content panels — colours kept as inline; layout/spacing in globals.css
// (.ivt-bk-panel-a / .ivt-bk-panel-b) so media-queries can override padding on narrow screens.
// These objects are intentionally empty; className carries the full visual treatment.
const panelA = 'ivt-bk-panel-a';
const panelB = 'ivt-bk-panel-b';

const durationRowStyle: React.CSSProperties = {
  display:    'flex',
  gap:        '8px',
  alignItems: 'stretch',
};

// ── WhatsApp message builder ──────────────────────────────────────────────────

function buildWhatsAppMessage(
  data: FormData,
  serviceLabel: string,
  activeService: string,
  b: import('@/lib/i18n/types').Dictionary['booking'],
  locale: string,
  customFieldAnswers: CustomFieldAnswer[],
  locationLabels: Record<string, string>,
  vehicleOptions: PublishedVehicleOption[],
): string {
  const displayValue = (value: string | undefined) => isolateLtrValues(value ?? '', locale);
  const field = (label: string, value: string | undefined) =>
    `${formatWhatsAppLabel(label)}: ${displayValue(value)}`;
  const locationLabel = (field: keyof FormData) => locationLabels[field] ?? (data[field] as string | undefined);
  const saat      = `${data.saatSaat}:${data.saatDakika}`;
  const fmtDate   = formatServiceDate(data.tarih, locale);
  const lines: string[] = [];

  lines.push(formatWhatsAppLabel(b.waHeading), field(b.waService, serviceLabel), '');

  if (activeService === 'AIRPORT_TRANSFER') {
    lines.push(field(b.waPickup, locationLabel('alisLokasyonu')));
    if (data.alisAdresi?.trim())  lines.push(field(b.waPickupAddress, data.alisAdresi));
    lines.push(field(b.waDropoff, locationLabel('varisLokasyonu')));
    if (data.varisAdresi?.trim()) lines.push(field(b.waDropoffAddress, data.varisAdresi));
    lines.push(field(b.waDate, fmtDate), field(b.waTime, saat));
    if (data.seyahatYonu) lines.push(field(b.waTripDirection, data.seyahatYonu === 'GIDIS_DONUS' ? b.tripRoundTrip : b.tripOneWay));
    if (data.ucusNumarasi?.trim()) lines.push(field(b.waFlightNumber, data.ucusNumarasi));
    if (data.bagajSayisi?.trim()) lines.push(field(b.waLuggageCount!, data.bagajSayisi));

  } else if (activeService === 'INTERCITY') {
    lines.push(field(b.waDepartureCity, locationLabel('kalkisIli')));
    if (data.kalkisAdres?.trim()) lines.push(field(b.waDepartureAddress, data.kalkisAdres));
    lines.push(field(b.waArrivalCity, locationLabel('varisIli')));
    if (data.varisAdres?.trim())  lines.push(field(b.waArrivalAddress, data.varisAdres));
    lines.push(field(b.waDate, fmtDate), field(b.waTime, saat));
    if (data.seyahatYonu) lines.push(field(b.waTripDirection, data.seyahatYonu === 'GIDIS_DONUS' ? b.tripRoundTrip : b.tripOneWay));
    if (data.bagajSayisi?.trim()) lines.push(field(b.waLuggageCount!, data.bagajSayisi));

  } else if (activeService === 'ALLOCATION') {
    lines.push(field(b.waPickup, locationLabel('alisLokasyonu')));
    if (data.alisAdresi?.trim())  lines.push(field(b.waPickupAddress, data.alisAdresi));
    lines.push(field(b.waStartDate, fmtDate), field(b.waStartTime, saat));
    if (data.tahsisSuresi) {
      const unit = data.tahsisSuresiUnit === 'GUN' ? b.waDays : b.waHours;
      lines.push(field(b.waDuration, `${data.tahsisSuresi} ${unit}`));
    }
    if (data.rotaAciklama?.trim()) lines.push(field(b.waRouteDescription, data.rotaAciklama));

  } else if (activeService === 'TOUR') {
    lines.push(field(b.waPickup, locationLabel('alisLokasyonu')));
    if (data.alisAdresi?.trim())  lines.push(field(b.waPickupAddress, data.alisAdresi));
    lines.push(field(b.waTourRoute, data.talepsRota));
    if (data.talepsYerler?.trim()) lines.push(field(b.waTourPlaces, data.talepsYerler));
    lines.push(field(b.waDate, fmtDate), field(b.waStartTime, saat));
    if (data.planlananSure?.trim()) {
      const unit = data.planlananSureUnit === 'GUN' ? b.waDays : b.waHours;
      lines.push(field(b.waPlannedDuration, `${data.planlananSure} ${unit}`));
    }
  }

  lines.push(
    '',
    field(b.waPassengers, `${data.yolcuSayisi} ${b.passengerSuffix}`),
    field(b.waFullName, data.adSoyad),
    field(b.waPhone, formatPhoneForWhatsAppMessage(data.telefon)),
  );
  if (data.email?.trim()) lines.push(field(b.waEmail, data.email.trim()));
  const selectedVehicle = vehicleOptions.find((vehicle) => vehicle.id === data.vehiclePreference);
  if (selectedVehicle) lines.push(field(b.waVehiclePreference!, selectedVehicle.displayName));
  for (const field of customFieldAnswers) {
    if (field.value === true) {
      lines.push(`✓ ${formatWhatsAppLabel(field.label)}`);
    } else if (typeof field.value === 'string' && field.value.trim()) {
      lines.push(`${formatWhatsAppLabel(field.label)}: ${displayValue(field.value.trim())}`);
    }
  }

  // Plain text only — openWhatsAppChat() is the single place that encodes
  // this for the wa.me URL / Android intent. Encoding it here too produced
  // double-encoded, unreadable messages (%2520 etc. instead of spaces and
  // line breaks) in WhatsApp.
  return lines.join('\n');
}

/**
 * Produces a date input value in the local operating timezone.
 * Kept outside the component so the initial SSR/client render can remain static.
 */
function getIstanbulNow(): { date: string; hour: string; minute: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const year  = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day   = parts.find((part) => part.type === 'day')?.value;
  const hour  = parts.find((part) => part.type === 'hour')?.value;
  const rawMinute = parts.find((part) => part.type === 'minute')?.value;

  if (!year || !month || !day || !hour || !rawMinute) {
    throw new Error('Istanbul tarih ve saati oluşturulamadı.');
  }

  const minute = String(Math.floor(Number(rawMinute) / 5) * 5).padStart(2, '0');
  return { date: `${year}-${month}-${day}`, hour, minute };
}

function isIstanbulCity(city: string | null | undefined): boolean {
  return city?.localeCompare('İstanbul', 'tr', { sensitivity: 'base' }) === 0;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BookingForm({
  sectionId = 'rezervasyon',
  homepageMode = false,
}: {
  sectionId?: string;
  /** Only the homepage booking section is managed by homepage CMS. */
  homepageMode?: boolean;
}) {
  const { dict, lang } = useLang();
  const b = dict.booking;
  const ui = getPublicUiCopy(lang);
  const cms = useHomepageCms();
  const bootstrap = useBookingFormData();
  const homepageSection = homepageMode ? cms?.reservationSection : null;

  // Localised service-type card labels — DB labels are always Turkish
  const ST_LABELS: Record<string, string> = {
    AIRPORT_TRANSFER: b.stAirportTransfer,
    INTERCITY:        b.stIntercity,
    ALLOCATION:       b.stAllocation,
    TOUR:             b.stTour,
  };

  const pathname = usePathname();
  // Extract the service slug from the URL for custom-field filtering
  // e.g. /tr/istanbul-havalimani-transfer → istanbul-havalimani-transfer
  const pageSlug = pathname?.split('/').filter(Boolean).at(-1) ?? '';

  const serviceTypes = bootstrap.serviceTypes;
  const [activeService, setActiveService] = useState(() => serviceTypes[0]?.key ?? 'AIRPORT_TRANSFER');
  const [submitting, setSubmitting]       = useState(false);
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [newsletterError, setNewsletterError]     = useState('');
  const websiteHoneypotRef = useRef<HTMLInputElement>(null);
  const companyHoneypotRef = useRef<HTMLInputElement>(null);
  const [formGuardToken, setFormGuardToken] = useState<string | null>(null);
  const customFields = useMemo(
    () => bootstrap.customFields.filter((field) =>
      field.isActive
      && (field.appliesToSlugs.length === 0 || field.appliesToSlugs.includes(pageSlug))),
    [bootstrap.customFields, pageSlug],
  );
  // State values for custom checkbox fields (keyed by field id)
  const [customFieldValues, setCustomFieldValues] = useState<Record<number, boolean | string>>({});
  const publishedVehicles = bootstrap.vehicles;
  const [locationLabels, setLocationLabels] = useState<Record<string, string>>({});
  const formSettings = bootstrap.formSettings;
  const [submissionNotice, setSubmissionNotice] = useState<{ kind: 'saved' | 'failed'; message: string } | null>(null);
  const [intercityPickupOption, setIntercityPickupOption] = useState<LocationOption | null>(null);
  const [intercityDropoffOption, setIntercityDropoffOption] = useState<LocationOption | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/data/form-guard?form=reservation', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { token?: string } | null) => {
        if (active && data?.token) setFormGuardToken(data.token);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  function rememberLocationLabel(field: keyof FormData, option: LocationOption | null) {
    setLocationLabels((current) => {
      const next = { ...current };
      if (option) next[field] = option.name;
      else delete next[field];
      return next;
    });
  }

  // Read ?hizmet= query param once on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hizmet = params.get('hizmet');
    if (hizmet && HIZMET_MAP[hizmet]) setActiveService(HIZMET_MAP[hizmet]);
  }, []);

  const schema = buildSchema(b);

  const {
    register,
    control,
    handleSubmit,
    watch,
    getValues,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      yolcuSayisi:       '1',
      saatSaat:          '',
      saatDakika:        '',
      tahsisSuresi:      '4',
      tahsisSuresiUnit:  'SAAT',
      planlananSureUnit: 'SAAT',
    },
  });

  // Avoid calculating a time-sensitive value during SSR: a date boundary
  // between server render and browser hydration would otherwise change the
  // input's min attribute and cause a hydration warning.
  const [today, setToday] = useState('');
  useEffect(() => {
    const current = getIstanbulNow();
    setToday(current.date);
    if (!getValues('tarih')) {
      setValue('tarih', current.date, { shouldDirty: false, shouldValidate: false });
    }
    if (!getValues('saatSaat')) {
      setValue('saatSaat', current.hour, { shouldDirty: false, shouldValidate: false });
    }
    if (!getValues('saatDakika')) {
      setValue('saatDakika', current.minute, { shouldDirty: false, shouldValidate: false });
    }
  }, [getValues, setValue]);

  const alisLokasyonuValue  = watch('alisLokasyonu');
  const varisLokasyonuValue = watch('varisLokasyonu');
  const kalkisIliValue      = watch('kalkisIli');
  const varisIliValue       = watch('varisIli');
  const tahsisSuresiUnit    = watch('tahsisSuresiUnit');
  const yolcuSayisi = watch('yolcuSayisi');
  const recommendedVehicle = findSmallestFittingVehicle(publishedVehicles, yolcuSayisi);

  const activeST = serviceTypes.find((s) => s.key === activeService);

  const optionalBadge = (
    <span style={{ color: '#4E6275', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '11px' }}>
      &nbsp;({b.optional})
    </span>
  );

  // ── Service field validation ───────────────────────────────────────────────
  function validateServiceFields(data: FormData): boolean {
    let valid = true;

    if (activeService === 'AIRPORT_TRANSFER') {
      if (!data.alisLokasyonu?.trim()) {
        setError('alisLokasyonu', { message: b.requiredPickup }); valid = false;
      }
      if (!data.varisLokasyonu?.trim()) {
        setError('varisLokasyonu', { message: b.requiredDropoff }); valid = false;
      }
      if (data.alisLokasyonu && data.varisLokasyonu && data.alisLokasyonu === data.varisLokasyonu) {
        setError('varisLokasyonu', { message: b.sameLocationError }); valid = false;
      }
    } else if (activeService === 'INTERCITY') {
      if (!data.kalkisIli?.trim()) {
        setError('kalkisIli', { message: b.requiredDeparture }); valid = false;
      }
      if (!data.varisIli?.trim()) {
        setError('varisIli', { message: b.requiredArrival }); valid = false;
      }
      if (data.kalkisIli && data.varisIli && data.kalkisIli === data.varisIli) {
        setError('varisIli', { message: b.sameProvinceError }); valid = false;
      }
    } else if (activeService === 'ALLOCATION') {
      if (!data.alisLokasyonu?.trim()) {
        setError('alisLokasyonu', { message: b.requiredAllocationLocation }); valid = false;
      }
      const n = parseInt(data.tahsisSuresi ?? '', 10);
      if (!data.tahsisSuresi?.trim() || isNaN(n) || n < 1) {
        setError('tahsisSuresi', { message: b.requiredDuration }); valid = false;
      } else if (!meetsAllocationMinimum(n, data.tahsisSuresiUnit)) {
        setError('tahsisSuresi', { message: b.minAllocationDuration }); valid = false;
      }
    } else if (activeService === 'TOUR') {
      if (!data.alisLokasyonu?.trim()) {
        setError('alisLokasyonu', { message: b.requiredAllocationLocation }); valid = false;
      }
      if (!data.talepsRota?.trim()) {
        setError('talepsRota', { message: b.requiredTourRoute }); valid = false;
      }
    }

    return valid;
  }

  // ── Submit handler ─────────────────────────────────────────────────────────
  const onSubmit = async (data: FormData) => {
    if (!validateServiceFields(data)) return;

    if (newsletterConsent && !data.email?.trim()) {
      setNewsletterError(b.newsletterEmailRequired);
      return;
    }
    setNewsletterError('');
    setSubmissionNotice(null);
    setSubmitting(true);

    const serviceLabel = ST_LABELS[activeService] ?? activeST?.label ?? activeService;
    const customFieldAnswers = customFields.flatMap((field): CustomFieldAnswer[] => {
      const value = customFieldValues[field.id];
      if (field.fieldType === 'checkbox') {
        return value === true ? [{ id: field.id, label: field.label, value: true }] : [];
      }
      return typeof value === 'string' && value.trim()
        ? [{ id: field.id, label: field.label, value: value.trim() }]
        : [];
    });
    const submittedFormData = { ...data, customFields: customFieldAnswers };
    const submissionId = crypto.randomUUID();
    const msg = buildWhatsAppMessage(
      data,
      serviceLabel,
      activeService,
      b,
      lang,
      customFieldAnswers,
      locationLabels,
      publishedVehicles,
    );

    // Open WhatsApp synchronously while the submit click still carries browser
    // user activation. This navigation is isolated from persistence: a blocked
    // tab never prevents the request, and a failed request never closes WhatsApp.
    try {
      openWhatsAppChat(SITE.whatsappNumber, msg);
    } catch {
      // Persistence below remains mandatory even if browser navigation fails.
    }

    // Start the independent keepalive write immediately after opening the tab.
    // The request and every retry keep the same idempotency key.
    let payload: string | null = null;
    let firstRequest: Promise<Response> | null = null;
    try {
      payload = JSON.stringify({
        intent:           'QUOTE',
        serviceType:      activeService,
        adSoyad:          data.adSoyad,
        telefon:          data.telefon,
        email:            data.email?.trim() ?? null,
        newsletterConsent,
        locale:           lang,
        submissionId,
        formGuardToken,
        website:          websiteHoneypotRef.current?.value ?? '',
        company:          companyHoneypotRef.current?.value ?? '',
        formData:         submittedFormData,
      });
      firstRequest = fetch('/data/submit-request', {
        method:    'POST',
        keepalive: true,
        signal:    AbortSignal.timeout(RESERVATION_REQUEST_TIMEOUT_MS),
        headers:   { 'Content-Type': 'application/json' },
        body: payload,
      });
    } catch {
      // The visible failure notice below handles payload construction failures.
    }

    // Await the already-started request. Gateway/network failures are retried
    // with the same idempotency key, so a late response cannot duplicate data.
    try {
      let requestSaved = false;
      let savedReference: string | undefined;
      if (!payload || !firstRequest) throw new Error('Reservation payload unavailable');
      for (let attempt = 0; attempt < RESERVATION_SUBMISSION_ATTEMPTS; attempt += 1) {
        if (attempt > 0) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, RESERVATION_RETRY_DELAYS_MS[attempt]);
          });
        }

        try {
          const response = attempt === 0
            ? await firstRequest
            : await fetch('/data/submit-request', {
                method:    'POST',
                keepalive: true,
                signal:    AbortSignal.timeout(RESERVATION_REQUEST_TIMEOUT_MS),
                headers:   { 'Content-Type': 'application/json' },
                body: payload,
              });

          const result = await response.json().catch(() => null) as {
            requestSaved?: boolean;
            referenceNumber?: string;
          } | null;
          if (response.ok && result?.requestSaved === true) {
            requestSaved = true;
            savedReference = result.referenceNumber;
            break;
          }
          // The application server already performs three database writes.
          // Browser retries are reserved for gateway/network failures.
          if (![502, 503, 504].includes(response.status)) break;
        } catch {
          // Continue to the next bounded network retry with the same ID.
        }
      }
      const statusCopy = SUBMISSION_STATUS_COPY[lang] ?? SUBMISSION_STATUS_COPY.en;
      setSubmissionNotice({
        kind: requestSaved ? 'saved' : 'failed',
        message: requestSaved && savedReference
          ? `${statusCopy.saved} ${savedReference}`
          : requestSaved ? statusCopy.saved : statusCopy.failed,
      });
    } catch {
      // Do not block the WhatsApp journey if browser-side payload construction
      // itself fails. No personal data is emitted to client-side logs.
      const statusCopy = SUBMISSION_STATUS_COPY[lang] ?? SUBMISSION_STATUS_COPY.en;
      setSubmissionNotice({ kind: 'failed', message: statusCopy.failed });
    } finally {
      // WhatsApp now opens in its own window, so this form remains mounted.
      // Always restore the CTA after persistence succeeds, fails, or times out.
      setSubmitting(false);
    }

    // GA4: track every booking form submission with service type and originating page
    trackEvent('reservation_submit', {
      service_type: activeService,
      page_path:    pathname,
    });

  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (homepageSection && !homepageSection.enabled) return null;

  return (
    <section
      id={sectionId}
      className="py-24 relative scroll-mt-24"
      style={{ background: 'linear-gradient(160deg, #F8F0DF 0%, #E4F1F8 48%, #EEEAF8 100%)' }}
      data-testid="booking-section"
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: '#D9E2EC' }} aria-hidden="true" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8">

        {/* Header */}
        <div className="text-center mb-12 ivt-booking-header">
          <span className="text-xs tracking-[0.3em] uppercase mb-4 block" style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}>
            {homepageSection?.eyebrow ?? b.sectionLabel}
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}>
            {homepageSection?.heading ?? b.sectionTitle}
          </h2>
          <p className="text-base max-w-lg mx-auto" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
            {homepageSection?.description ?? b.sectionDescription}
          </p>
        </div>

        {/* Form card */}
        <div
          className="relative rounded-2xl overflow-hidden ivt-booking-card"
          style={{
            background:  '#FFFFFF',
            border:      '1px solid #D9E2EC',
            boxShadow:   '0 8px 40px rgba(16,42,67,0.08)',
          }}
          data-testid="booking-form-card"
        >
          <div className="h-[3px] w-full" style={{ background: 'linear-gradient(90deg, transparent, #C79A35 30%, #E4B84B 50%, #C79A35 70%, transparent)' }} aria-hidden="true" />
          <div className="p-5 sm:p-6 md:p-10 pub-form">

            {/* Panel — Service type */}
            <div className={panelB} data-testid="service-panel">
              <p className="text-xs tracking-[0.18em] uppercase mb-3 font-semibold" style={{ color: '#263F55', fontFamily: 'Inter, sans-serif' }}>
                {b.serviceTypeLabel}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2" role="group" aria-label={b.serviceTypeLabel}>
                  {serviceTypes.map((st) => {
                    const isActive  = activeService === st.key;
                    const iconColor = isActive ? SERVICE_ICON_COLORS[st.key] ?? '#C79A35' : '#718596';
                    return (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => { setActiveService(st.key); clearErrors(); }}
                        aria-pressed={isActive}
                         className="flex flex-row sm:flex-col items-center justify-start sm:justify-center gap-3 sm:gap-1.5 w-full py-3 px-4 sm:px-2 rounded-xl text-xs font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C79A35] focus-visible:ring-offset-2"
                        style={{
                          border:     isActive ? `2px solid ${SERVICE_ICON_COLORS[st.key] ?? '#C79A35'}` : '2px solid rgba(196,181,253,0.5)',
                          background: isActive ? `${SERVICE_ICON_COLORS[st.key]}15`                      : '#FFFFFF',
                          color:      isActive ? '#102A43'                                               : '#50677A',
                          fontFamily: 'Inter, sans-serif',
                          minHeight:  '64px',
                          touchAction: 'manipulation',
                        }}
                        data-testid={`service-type-${st.key}`}
                      >
                        <span style={{ color: iconColor }}>{SERVICE_ICONS[st.key] ?? <MapPin size={20} />}</span>
                        <span className="text-center leading-tight">{ST_LABELS[st.key] ?? st.label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {bootstrap.optionsStatus === 'error' && (
              <div
                role="alert"
                className="mb-5 rounded-xl border px-4 py-3 text-sm"
                style={{ borderColor: '#F5C2C7', background: '#FFF5F5', color: '#842029' }}
              >
                <p>{ui.errors.message}</p>
                <button
                  type="button"
                  onClick={bootstrap.retryOptions}
                  className="mt-2 font-semibold underline underline-offset-2"
                >
                  {ui.errors.retry}
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} data-testid="booking-form" noValidate>
              {/* Honeypots — offscreen + tabIndex=-1 hides from keyboard and AT;
                  aria-hidden removed because WCAG forbids aria-hidden on focusable elements */}
              <input
                ref={websiteHoneypotRef}
                type="text"
                name="website"
                tabIndex={-1}
                aria-label="Website"
                autoComplete="url"
                style={HONEYPOT_STYLE}
              />
              <input
                ref={companyHoneypotRef}
                type="text"
                name="company"
                tabIndex={-1}
                aria-label="Company"
                autoComplete="organization"
                style={HONEYPOT_STYLE}
              />

              {/* Panel A — Service-specific fields */}
              <div className={panelA} data-testid="service-fields-panel">
                <p className="text-xs tracking-[0.15em] uppercase mb-4 font-semibold" style={{ color: '#263F55', fontFamily: 'Inter, sans-serif' }}>
                  {activeService === 'AIRPORT_TRANSFER' ? b.routeFieldsLabel
                    : activeService === 'INTERCITY'     ? b.routeFieldsLabel
                    : activeService === 'ALLOCATION'    ? b.allocationFieldsLabel
                    : b.tourFieldsLabel}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">

                  {/* AIRPORT_TRANSFER */}
                  {activeService === 'AIRPORT_TRANSFER' && (<>
                    <div data-testid="field-alis-lokasyon">
                      <label htmlFor="bf-alis-lokasyon" style={labelStyle}><MapPin size={12} aria-hidden="true" /> {b.pickupLocation}</label>
                      <Controller control={control} name="alisLokasyonu" render={({ field }) => (
                        <LocationCombobox id="bf-alis-lokasyon" ariaLabel={b.pickupLocation} for="pickup" scope="local" options={bootstrap.locations.localPickup} value={field.value ?? ''} onChange={field.onChange}
                          onOptionChange={(option) => rememberLocationLabel('alisLokasyonu', option)}
                          placeholder={b.pickupPlaceholder} loadingText={dict.common.loading} labels={ui.location} error={!!errors.alisLokasyonu} excludeId={varisLokasyonuValue} />
                      )} />
                      {errors.alisLokasyonu && <p role="alert" style={errorStyle}>{errors.alisLokasyonu.message}</p>}
                    </div>
                    <div data-testid="field-varis-lokasyon">
                      <label htmlFor="bf-varis-lokasyon" style={labelStyle}><MapPin size={12} aria-hidden="true" /> {b.dropoffLocation}</label>
                      <Controller control={control} name="varisLokasyonu" render={({ field }) => (
                        <LocationCombobox id="bf-varis-lokasyon" ariaLabel={b.dropoffLocation} for="dropoff" scope="local" options={bootstrap.locations.localDropoff} value={field.value ?? ''} onChange={field.onChange}
                          onOptionChange={(option) => rememberLocationLabel('varisLokasyonu', option)}
                          placeholder={b.dropoffPlaceholder} loadingText={dict.common.loading} labels={ui.location} error={!!errors.varisLokasyonu} excludeId={alisLokasyonuValue} />
                      )} />
                      {errors.varisLokasyonu && <p role="alert" style={errorStyle}>{errors.varisLokasyonu.message}</p>}
                    </div>
                    <div>
                      <label htmlFor="bf-alis-adresi" style={labelStyle}><Home size={12} aria-hidden="true" /> {b.pickupAddress} {optionalBadge}</label>
                      <input id="bf-alis-adresi" type="text" {...register('alisAdresi')} className="vip-input"
                        placeholder={b.pickupAddressPlaceholder} autoComplete="address-line1" />
                    </div>
                    <div>
                      <label htmlFor="bf-varis-adresi" style={labelStyle}><Home size={12} aria-hidden="true" /> {b.dropoffAddress} {optionalBadge}</label>
                      <input id="bf-varis-adresi" type="text" {...register('varisAdresi')} className="vip-input"
                        placeholder={b.dropoffAddressPlaceholder} autoComplete="off" />
                    </div>
                    <div>
                      <label htmlFor="bf-ucus-no" style={labelStyle}><Plane size={12} aria-hidden="true" /> {b.flightNumber} {optionalBadge}</label>
                      <input id="bf-ucus-no" type="text" {...register('ucusNumarasi')} className="vip-input"
                        placeholder={b.flightNumberPlaceholder} autoComplete="off" />
                    </div>
                    <div>
                      <label htmlFor="bf-bagaj" style={labelStyle}><Briefcase size={12} aria-hidden="true" /> {b.luggageCount} {optionalBadge}</label>
                      <input id="bf-bagaj" type="number" min="0" inputMode="numeric" {...register('bagajSayisi')} className="vip-input"
                        placeholder={b.luggageCountPlaceholder} />
                    </div>
                    <div>
                      <label htmlFor="bf-seyahat-yonu" style={labelStyle}><ArrowRightLeft size={12} aria-hidden="true" /> {b.tripDirection} {optionalBadge}</label>
                      <select id="bf-seyahat-yonu" {...register('seyahatYonu')} className="vip-input vip-select">
                        <option value="GIDIS">{b.tripOneWay}</option>
                        <option value="GIDIS_DONUS">{b.tripRoundTrip}</option>
                      </select>
                    </div>
                  </>)}

                  {/* INTERCITY */}
                  {activeService === 'INTERCITY' && (<>
                    <div data-testid="field-kalkis-ili">
                      <label htmlFor="bf-kalkis-ili" style={labelStyle}><MapPin size={12} aria-hidden="true" /> {b.departureCity}</label>
                      <Controller control={control} name="kalkisIli" render={({ field }) => (
                        <LocationCombobox id="bf-kalkis-ili" ariaLabel={b.departureCity} for="pickup" scope="intercity" options={bootstrap.locations.intercityPickup} value={field.value ?? ''} onChange={field.onChange}
                          onOptionChange={(option) => {
                            rememberLocationLabel('kalkisIli', option);
                            setIntercityPickupOption(option);
                          }}
                          placeholder={b.departureCityPlaceholder} loadingText={dict.common.loading} labels={ui.location} error={!!errors.kalkisIli} excludeId={varisIliValue}
                          excludeCity={isIstanbulCity(intercityDropoffOption?.city) ? 'İstanbul' : undefined} />
                      )} />
                      {errors.kalkisIli && <p role="alert" style={errorStyle}>{errors.kalkisIli.message}</p>}
                    </div>
                    <div data-testid="field-varis-ili">
                      <label htmlFor="bf-varis-ili" style={labelStyle}><MapPin size={12} aria-hidden="true" /> {b.arrivalCity}</label>
                      <Controller control={control} name="varisIli" render={({ field }) => (
                        <LocationCombobox id="bf-varis-ili" ariaLabel={b.arrivalCity} for="dropoff" scope="intercity" options={bootstrap.locations.intercityDropoff} value={field.value ?? ''} onChange={field.onChange}
                          onOptionChange={(option) => {
                            rememberLocationLabel('varisIli', option);
                            setIntercityDropoffOption(option);
                          }}
                          placeholder={b.arrivalCityPlaceholder} loadingText={dict.common.loading} labels={ui.location} error={!!errors.varisIli} excludeId={kalkisIliValue}
                          excludeCity={isIstanbulCity(intercityPickupOption?.city) ? 'İstanbul' : undefined} />
                      )} />
                      {errors.varisIli && <p role="alert" style={errorStyle}>{errors.varisIli.message}</p>}
                    </div>
                    <div>
                      <label htmlFor="bf-kalkis-adres" style={labelStyle}><Home size={12} aria-hidden="true" /> {b.departureAddress} {optionalBadge}</label>
                      <input id="bf-kalkis-adres" type="text" {...register('kalkisAdres')} className="vip-input"
                        placeholder={b.departureCityAddressPlaceholder} autoComplete="address-line1" />
                    </div>
                    <div>
                      <label htmlFor="bf-varis-adres" style={labelStyle}><Home size={12} aria-hidden="true" /> {b.arrivalAddress} {optionalBadge}</label>
                      <input id="bf-varis-adres" type="text" {...register('varisAdres')} className="vip-input"
                        placeholder={b.arrivalCityAddressPlaceholder} autoComplete="off" />
                    </div>
                    <div>
                      <label htmlFor="bf-bagaj-ic" style={labelStyle}><Briefcase size={12} aria-hidden="true" /> {b.luggageCount} {optionalBadge}</label>
                      <input id="bf-bagaj-ic" type="number" min="0" inputMode="numeric" {...register('bagajSayisi')} className="vip-input"
                        placeholder={b.luggageCountPlaceholder} />
                    </div>
                    <div>
                      <label htmlFor="bf-seyahat-yonu-ic" style={labelStyle}><ArrowRightLeft size={12} aria-hidden="true" /> {b.tripDirection} {optionalBadge}</label>
                      <select id="bf-seyahat-yonu-ic" {...register('seyahatYonu')} className="vip-input vip-select">
                        <option value="GIDIS">{b.tripOneWay}</option>
                        <option value="GIDIS_DONUS">{b.tripRoundTrip}</option>
                      </select>
                    </div>
                  </>)}

                  {/* ALLOCATION */}
                  {activeService === 'ALLOCATION' && (<>
                    <div data-testid="field-alis-alloc">
                      <label htmlFor="bf-alis-lokasyon" style={labelStyle}><MapPin size={12} aria-hidden="true" /> {b.allocationLocation}</label>
                      <Controller control={control} name="alisLokasyonu" render={({ field }) => (
                        <LocationCombobox id="bf-alis-lokasyon" ariaLabel={b.allocationLocation} for="pickup" scope="local" options={bootstrap.locations.localPickup} value={field.value ?? ''} onChange={field.onChange}
                          onOptionChange={(option) => rememberLocationLabel('alisLokasyonu', option)}
                          placeholder={b.tourPickupPlaceholder} loadingText={dict.common.loading} labels={ui.location} error={!!errors.alisLokasyonu} />
                      )} />
                      {errors.alisLokasyonu && <p role="alert" style={errorStyle}>{errors.alisLokasyonu.message}</p>}
                    </div>
                    <div>
                      <label htmlFor="bf-alloc-alis-adresi" style={labelStyle}><Home size={12} aria-hidden="true" /> {b.pickupAddress} {optionalBadge}</label>
                      <input id="bf-alloc-alis-adresi" type="text" {...register('alisAdresi')} className="vip-input"
                        placeholder={b.allocationAddressPlaceholder} autoComplete="address-line1" />
                    </div>
                    <div data-testid="field-tahsis">
                      {/* Duration group: two inputs, each labelled via aria-label */}
                      <p style={labelStyle}><Clock size={12} aria-hidden="true" /> {b.allocationDuration}</p>
                      <div style={durationRowStyle}>
                        <input
                          type="number"
                          min={tahsisSuresiUnit === 'SAAT' ? MIN_ALLOCATION_HOURS : 1}
                          step="1"
                          inputMode="numeric"
                          aria-label={b.allocationDurationAmountLabel}
                          {...register('tahsisSuresi')}
                          className="vip-input"
                          placeholder={tahsisSuresiUnit === 'SAAT' ? 'Min. 4' : 'Min. 1'}
                          style={{ flex: '1 1 0', minWidth: 0 }}
                        />
                        <select
                          aria-label={b.allocationDurationUnitLabel}
                          {...register('tahsisSuresiUnit')}
                          className="vip-input vip-select"
                          style={{ flex: '0 0 100px', width: '100px' }}
                        >
                          <option value="SAAT">{b.allocationHours}</option>
                          <option value="GUN">{b.allocationDays}</option>
                        </select>
                      </div>
                      {errors.tahsisSuresi
                        ? <p role="alert" style={errorStyle}>{errors.tahsisSuresi.message}</p>
                        : tahsisSuresiUnit === 'SAAT'
                          ? <p style={hintStyle}>{b.minAllocationDuration}</p>
                          : null}
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="bf-rota-aciklama" style={labelStyle}><MapPin size={12} aria-hidden="true" /> {b.routeDescription} {optionalBadge}</label>
                      <textarea id="bf-rota-aciklama" {...register('rotaAciklama')} className="vip-input"
                        placeholder={b.allocationRoutePlaceholder} rows={2}
                        style={{ width: '100%', resize: 'vertical', minHeight: '72px' }} />
                    </div>
                  </>)}

                  {/* TOUR */}
                  {activeService === 'TOUR' && (<>
                    <div data-testid="field-alis-tour">
                      <label htmlFor="bf-alis-lokasyon" style={labelStyle}><MapPin size={12} aria-hidden="true" /> {b.allocationLocation}</label>
                      <Controller control={control} name="alisLokasyonu" render={({ field }) => (
                        <LocationCombobox id="bf-alis-lokasyon" ariaLabel={b.allocationLocation} for="pickup" scope="local" options={bootstrap.locations.localPickup} value={field.value ?? ''} onChange={field.onChange}
                          onOptionChange={(option) => rememberLocationLabel('alisLokasyonu', option)}
                          placeholder={b.tourPickupPlaceholder} loadingText={dict.common.loading} labels={ui.location} error={!!errors.alisLokasyonu} />
                      )} />
                      {errors.alisLokasyonu && <p role="alert" style={errorStyle}>{errors.alisLokasyonu.message}</p>}
                    </div>
                    <div>
                      <label htmlFor="bf-tour-alis-adresi" style={labelStyle}><Home size={12} aria-hidden="true" /> {b.pickupAddress} {optionalBadge}</label>
                      <input id="bf-tour-alis-adresi" type="text" {...register('alisAdresi')} className="vip-input"
                        placeholder={b.tourAddressPlaceholder} autoComplete="address-line1" />
                    </div>
                    <div className="md:col-span-2" data-testid="field-rota-tour">
                      <label htmlFor="bf-taleps-rota" style={labelStyle}><Compass size={12} aria-hidden="true" /> {b.tourRoute}</label>
                      <input id="bf-taleps-rota" type="text" {...register('talepsRota')} className="vip-input"
                        placeholder={b.tourRoutePlaceholder} />
                      {errors.talepsRota && <p role="alert" style={errorStyle}>{errors.talepsRota.message}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="bf-taleps-yerler" style={labelStyle}><MapPin size={12} aria-hidden="true" /> {b.tourPlaces} {optionalBadge}</label>
                      <textarea id="bf-taleps-yerler" {...register('talepsYerler')} className="vip-input"
                        placeholder={b.tourPlacesPlaceholder} rows={2}
                        style={{ width: '100%', resize: 'vertical', minHeight: '72px' }} />
                    </div>
                    <div data-testid="field-sure-tour">
                      {/* Duration group: two inputs, each labelled via aria-label */}
                      <p style={labelStyle}><Clock size={12} aria-hidden="true" /> {b.plannedDuration} {optionalBadge}</p>
                      <div style={durationRowStyle}>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          aria-label={b.plannedDurationAmountLabel}
                          {...register('planlananSure')}
                          className="vip-input"
                          placeholder="ör. 4"
                          style={{ flex: '1 1 0', minWidth: 0 }}
                        />
                        <select
                          aria-label={b.plannedDurationUnitLabel}
                          {...register('planlananSureUnit')}
                          className="vip-input vip-select"
                          style={{ flex: '0 0 100px', width: '100px' }}
                        >
                          <option value="SAAT">{b.allocationHours}</option>
                          <option value="GUN">{b.allocationDays}</option>
                        </select>
                      </div>
                    </div>
                  </>)}

                </div>
              </div>

              {/* Panel B — Date / Time / Passengers */}
              <div className={panelB} data-testid="datetime-panel">
                <p className="text-xs tracking-[0.15em] uppercase mb-4 font-semibold" style={{ color: '#263F55', fontFamily: 'Inter, sans-serif' }}>
                  {activeService === 'ALLOCATION' ? b.startPanel : b.datetimePanel}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">

                  <div data-testid="field-tarih">
                    <label htmlFor="bf-tarih" style={labelStyle}>
                      <Calendar size={12} aria-hidden="true" />
                      {activeService === 'ALLOCATION' ? b.waStartDate : b.date}
                    </label>
                    <input id="bf-tarih" type="date" {...register('tarih')} className="vip-input" min={today}
                      style={{ colorScheme: 'light' }}
                      data-testid="input-tarih" />
                    {errors.tarih && <p role="alert" style={errorStyle}>{errors.tarih.message}</p>}
                  </div>

                  <div data-testid="field-saat">
                    {/* Time group: two selects each with individual aria-label */}
                    <p style={labelStyle}>
                      <Clock size={12} aria-hidden="true" />
                      {activeService === 'ALLOCATION' || activeService === 'TOUR' ? b.waStartTime : b.time}
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select {...register('saatSaat')} className="vip-input vip-select" style={{ flex: 1 }}
                        aria-label={b.hourAbbr} data-testid="input-saat-saat">
                        <option value="">{b.hourAbbr}</option>
                        {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <select {...register('saatDakika')} className="vip-input vip-select" style={{ flex: 1 }}
                        aria-label={b.minuteAbbr} data-testid="input-saat-dakika">
                        <option value="">{b.minuteAbbr}</option>
                        {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    {(errors.saatSaat || errors.saatDakika) && (
                      <p role="alert" style={errorStyle}>{errors.saatSaat?.message ?? errors.saatDakika?.message}</p>
                    )}
                  </div>

                  <div data-testid="field-yolcu">
                    <label htmlFor="bf-yolcu" style={labelStyle}><Users size={12} aria-hidden="true" /> {b.passengerCount}</label>
                    <select id="bf-yolcu" {...register('yolcuSayisi')} className="vip-input vip-select" data-testid="input-yolcu">
                      {Array.from({ length: 45 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={String(n)}>{n} {b.passengerSuffix}</option>
                      ))}
                    </select>
                    <p style={hintStyle}>
                      {recommendedVehicle
                        ? `${b.vehicleHint} ${recommendedVehicle.displayName} (${recommendedVehicle.passengerCapacity} ${b.passengerSuffix})`
                        : b.vehicleHint}
                    </p>
                  </div>
                  {formSettings.showVehiclePreference && publishedVehicles.length > 0 && (
                    <div data-testid="field-vehicle-preference">
                      <label htmlFor="bf-vehicle-preference" style={labelStyle}>
                        <Car size={12} aria-hidden="true" /> {b.vehiclePreference}
                      </label>
                      <select
                        id="bf-vehicle-preference"
                        {...register('vehiclePreference')}
                        className="vip-input vip-select"
                        data-testid="input-vehicle-preference"
                      >
                        <option value="">{b.vehiclePreferenceDefault}</option>
                        {publishedVehicles.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.displayName}
                            {vehicle.passengerCapacity ? ` (${vehicle.passengerCapacity} ${b.passengerSuffix})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                </div>
              </div>

              {/* Panel A — Contact */}
              <div className={panelA} data-testid="contact-panel">
                <p className="text-xs tracking-[0.15em] uppercase mb-4 font-semibold" style={{ color: '#263F55', fontFamily: 'Inter, sans-serif' }}>
                  {b.contactPanel}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                  <div data-testid="field-adsoyad">
                    <label htmlFor="bf-adsoyad" style={labelStyle}><User size={12} aria-hidden="true" /> {b.fullName}</label>
                    <input id="bf-adsoyad" type="text" {...register('adSoyad')} className="vip-input"
                      placeholder={b.namePlaceholder} autoComplete="name"
                      inputMode="text" data-testid="input-adsoyad" />
                    {errors.adSoyad && <p role="alert" style={errorStyle}>{errors.adSoyad.message}</p>}
                  </div>
                  <div data-testid="field-telefon">
                    <label htmlFor="bf-telefon" style={labelStyle}><Phone size={12} aria-hidden="true" /> {b.phone}</label>
                    <input id="bf-telefon" type="tel" {...register('telefon')} className="vip-input"
                      placeholder={b.phonePlaceholder} autoComplete="tel"
                      inputMode="tel" data-testid="input-telefon" dir="ltr" />
                    {errors.telefon && <p role="alert" style={errorStyle}>{errors.telefon.message}</p>}
                  </div>
                </div>
              </div>

              {/* Existing admin-defined custom fields remain available. The
                  discontinued luggage/seat/vehicle/note controls are no longer
                  rendered or included in the WhatsApp payload. */}
              {customFields.length > 0 && (
                <div className={panelA} data-testid="optional-fields-panel">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                    {/* Admin-defined custom fields */}
                    {customFields.map(field => {
                      const customValue = customFieldValues[field.id];
                      return (
                        <div key={field.id} className={field.fieldType === 'text' ? 'md:col-span-2' : ''} data-testid={`custom-field-${field.id}`}>
                          {field.fieldType === 'checkbox' ? (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#263F55' }}>
                              <input
                                type="checkbox"
                                checked={customValue === true}
                                onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.checked }))}
                                style={{ width: '16px', height: '16px', accentColor: '#C79A35', flexShrink: 0 }}
                              />
                              {field.label}
                            </label>
                          ) : (
                            <>
                          <label htmlFor={`bf-custom-${field.id}`} style={labelStyle}>{field.label}</label>
                              <input
                            id={`bf-custom-${field.id}`}
                                type="text"
                                className="vip-input"
                                placeholder={field.label}
                                value={typeof customValue === 'string' ? customValue : ''}
                                onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Panel B — Email + Newsletter */}
              <div className={panelB} data-testid="email-panel">
                <div className="grid grid-cols-1 gap-4">
                  <div data-testid="field-email">
                    <label htmlFor="bf-email" style={labelStyle}><Mail size={12} aria-hidden="true" /> {b.email} {optionalBadge}</label>
                    <input id="bf-email" type="email" {...register('email')} className="vip-input"
                      placeholder={b.emailPlaceholder} autoComplete="email" inputMode="email"
                      style={{ maxWidth: '420px' }} dir="ltr" />
                  </div>

                  {/* Newsletter checkbox */}
                  <div data-testid="field-newsletter">
                    <label style={{
                      display:    'flex',
                      alignItems: 'flex-start',
                      gap:        '10px',
                      cursor:     'pointer',
                      fontSize:   '13px',
                      color:      '#263F55',
                      fontFamily: 'Inter, sans-serif',
                      lineHeight: '1.5',
                    }}>
                      <input
                        type="checkbox"
                        checked={newsletterConsent}
                        onChange={(e) => { setNewsletterConsent(e.target.checked); setNewsletterError(''); }}
                        style={{ marginTop: '2px', accentColor: '#2563EB', flexShrink: 0, width: '16px', height: '16px', minWidth: '16px' }}
                        data-testid="newsletter-checkbox"
                      />
                      <span>
                        {b.newsletterConsent}{' '}
                        <a href={localizedPublicPath('/yasal/kvkk-aydinlatma-metni', lang)} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#2563EB', textDecoration: 'underline' }}>
                          {b.kvkkLink}
                        </a>{' '}
                        {lang === 'tr' ? 've' : '/'}{' '}
                        <a href={localizedPublicPath('/yasal/ticari-iletisim-bilgilendirmesi', lang)} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#2563EB', textDecoration: 'underline' }}>
                          {b.commercialLink}
                        </a>
                      </span>
                    </label>
                    {newsletterError && (
                      <p role="alert" style={{ ...errorStyle, marginTop: '6px' }} data-testid="newsletter-error">
                        {newsletterError}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Notice */}
              <div className="mt-2 mb-6 rounded-xl px-5 py-4" style={{ background: 'rgba(199,154,53,0.06)', border: '1px solid rgba(199,154,53,0.25)' }}>
                <p className="text-xs leading-relaxed" style={{ color: '#6B5C2E', fontFamily: 'Inter, sans-serif' }}>
                  <strong>{b.importantLabel}</strong> {b.importantNotice}
                </p>
              </div>

              {/* Submit */}
              <div className="text-center">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-3 w-full sm:w-auto px-8 sm:px-10 py-4 rounded-xl text-sm font-semibold tracking-wider uppercase transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#C79A35] disabled:opacity-70 disabled:cursor-not-allowed"
                  style={{
                    background:    '#25D366',
                    color:         '#102A43',
                    fontFamily:    'Inter, sans-serif',
                    letterSpacing: '0.05em',
                    minHeight:     '56px',
                    minWidth:      '260px',
                    maxWidth:      '100%',
                    touchAction:   'manipulation',
                  }}
                  data-testid="booking-submit-button"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                      {b.submittingLabel}
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                      </svg>
                      {b.submitButton}
                    </>
                  )}
                </button>
                <p className="mt-4 text-xs" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
                  {b.directMessage}
                </p>
                {submissionNotice && (
                  <div
                    role={submissionNotice.kind === 'saved' ? 'status' : 'alert'}
                    aria-live="polite"
                    data-testid="reservation-submission-status"
                    className="mt-4 rounded-xl px-4 py-3 text-left text-sm"
                    style={{
                      background: submissionNotice.kind === 'saved' ? '#F0FDF4' : '#FEF2F2',
                      border: `1px solid ${submissionNotice.kind === 'saved' ? '#86EFAC' : '#FCA5A5'}`,
                      color: submissionNotice.kind === 'saved' ? '#166534' : '#991B1B',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {submissionNotice.message}
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
