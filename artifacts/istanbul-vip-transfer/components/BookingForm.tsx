'use client';

import { useState, useRef, useEffect } from 'react';
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
  Plane, ArrowRightLeft, Car, Compass, Mail,
} from 'lucide-react';
import LocationCombobox from './LocationCombobox';
import { useLang } from '@/lib/i18n/context';
import { formatServiceDate } from '@/lib/booking-date';
import {
  isFiveMinuteIncrement,
  isValidPassengerCount,
  meetsAllocationMinimum,
  MIN_ALLOCATION_HOURS,
} from '@/lib/booking-rules';
import { isolateLtrValues } from '@/lib/i18n/bidi';
import { getPublicUiCopy } from '@/lib/i18n/public-ui';
import { localizedPublicPath } from '@/lib/localized-service-path';
import { useHomepageCms } from '@/lib/homepage-cms-context';

// ── Constants ─────────────────────────────────────────────────────────────────

const WA_NUMBER = '905326600847';

interface CustomField {
  id: number;
  label: string;
  appliesToSlugs: string[];
  fieldType: string;
  isActive: boolean;
  sortOrder: number;
}

interface CustomFieldAnswer {
  id: number;
  label: string;
  value: boolean | string;
}

// ── Service type defs ─────────────────────────────────────────────────────────

interface ServiceTypeOption {
  id: string;
  key: string;
  label: string;
  description: string | null;
  quoteEnabled: boolean;
  reservationEnabled: boolean;
}

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
): string {
  const displayValue = (value: string | undefined) => isolateLtrValues(value ?? '', locale);
  const saat      = `${data.saatSaat}:${data.saatDakika}`;
  const fmtDate   = formatServiceDate(data.tarih, locale);
  const lines: string[] = [];

  lines.push(b.waHeading, `${b.waService}: ${displayValue(serviceLabel)}`, '');

  if (activeService === 'AIRPORT_TRANSFER') {
    lines.push(`${b.waPickup}: ${displayValue(data.alisLokasyonu)}`);
    if (data.alisAdresi?.trim())  lines.push(`${b.waPickupAddress}: ${displayValue(data.alisAdresi)}`);
    lines.push(`${b.waDropoff}: ${displayValue(data.varisLokasyonu)}`);
    if (data.varisAdresi?.trim()) lines.push(`${b.waDropoffAddress}: ${displayValue(data.varisAdresi)}`);
    lines.push(`${b.waDate}: ${displayValue(fmtDate)}`, `${b.waTime}: ${displayValue(saat)}`);

  } else if (activeService === 'INTERCITY') {
    lines.push(`${b.waDepartureCity}: ${displayValue(data.kalkisIli)}`);
    if (data.kalkisAdres?.trim()) lines.push(`${b.waDepartureAddress}: ${displayValue(data.kalkisAdres)}`);
    lines.push(`${b.waArrivalCity}: ${displayValue(data.varisIli)}`);
    if (data.varisAdres?.trim())  lines.push(`${b.waArrivalAddress}: ${displayValue(data.varisAdres)}`);
    lines.push(`${b.waDate}: ${displayValue(fmtDate)}`, `${b.waTime}: ${displayValue(saat)}`);

  } else if (activeService === 'ALLOCATION') {
    lines.push(`${b.waPickup}: ${displayValue(data.alisLokasyonu)}`);
    if (data.alisAdresi?.trim())  lines.push(`${b.waPickupAddress}: ${displayValue(data.alisAdresi)}`);
    lines.push(`${b.waStartDate}: ${displayValue(fmtDate)}`, `${b.waStartTime}: ${displayValue(saat)}`);
    if (data.tahsisSuresi) {
      const unit = data.tahsisSuresiUnit === 'GUN' ? b.waDays : b.waHours;
       lines.push(`${b.waDuration}: ${displayValue(data.tahsisSuresi)} ${unit}`);
    }
    if (data.rotaAciklama?.trim()) lines.push(`${b.waRouteDescription}: ${data.rotaAciklama}`);

  } else if (activeService === 'TOUR') {
    lines.push(`${b.waPickup}: ${displayValue(data.alisLokasyonu)}`);
    if (data.alisAdresi?.trim())  lines.push(`${b.waPickupAddress}: ${displayValue(data.alisAdresi)}`);
    lines.push(`${b.waTourRoute}: ${displayValue(data.talepsRota)}`);
    if (data.talepsYerler?.trim()) lines.push(`${b.waTourPlaces}: ${displayValue(data.talepsYerler)}`);
    lines.push(`${b.waDate}: ${displayValue(fmtDate)}`, `${b.waStartTime}: ${displayValue(saat)}`);
    if (data.planlananSure?.trim()) {
      const unit = data.planlananSureUnit === 'GUN' ? b.waDays : b.waHours;
       lines.push(`${b.waPlannedDuration}: ${displayValue(data.planlananSure)} ${unit}`);
    }
  }

  lines.push(
    '',
    `${b.waPassengers}: ${displayValue(data.yolcuSayisi)} ${b.passengerSuffix}`,
    `${b.waFullName}: ${displayValue(data.adSoyad)}`,
    `${b.waPhone}: ${displayValue(data.telefon)}`,
  );
  if (data.email?.trim()) lines.push(`${b.waEmail}: ${displayValue(data.email.trim())}`);
  for (const field of customFieldAnswers) {
    if (field.value === true) {
      lines.push(`✓ ${displayValue(field.label)}`);
    } else if (typeof field.value === 'string' && field.value.trim()) {
      lines.push(`${displayValue(field.label)}: ${displayValue(field.value.trim())}`);
    }
  }

  return encodeURIComponent(lines.join('\n'));
}

/**
 * Produces a date input value in the local operating timezone.
 * Kept outside the component so the initial SSR/client render can remain static.
 */
function getIstanbulToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year  = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day   = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Istanbul tarihi oluşturulamadı.');
  }

  return `${year}-${month}-${day}`;
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

  const [serviceTypes, setServiceTypes]   = useState<ServiceTypeOption[]>([]);
  const [activeService, setActiveService] = useState('AIRPORT_TRANSFER');
  const [loadingST, setLoadingST]         = useState(true);
  const [submitting, setSubmitting]       = useState(false);
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [newsletterError, setNewsletterError]     = useState('');
  const honeypotRef = useRef<HTMLInputElement>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  // State values for custom checkbox fields (keyed by field id)
  const [customFieldValues, setCustomFieldValues] = useState<Record<number, boolean | string>>({});

  // Fetch admin-defined custom fields for this service slug
  useEffect(() => {
    const url = pageSlug ? `/data/custom-fields?slug=${encodeURIComponent(pageSlug)}` : '/data/custom-fields';
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then((d: { fields?: CustomField[] } | null) => {
        if (d?.fields) setCustomFields(d.fields.filter(f => f.isActive));
      })
      .catch(() => {});
  }, [pageSlug]);

  // Avoid calculating a time-sensitive value during SSR: a date boundary
  // between server render and browser hydration would otherwise change the
  // input's min attribute and cause a hydration warning.
  const [today, setToday] = useState('');
  useEffect(() => {
    setToday(getIstanbulToday());
  }, []);

  // Load service types once on mount
  useEffect(() => {
    fetch('/data/service-types')
      .then((r) => r.json())
      .then((d) => {
        const items: ServiceTypeOption[] = d.items ?? [];
        setServiceTypes(items);
        if (items.length > 0) setActiveService(items[0].key);
        setLoadingST(false);
      })
      .catch(() => setLoadingST(false));
  }, []);

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

  const alisLokasyonuValue  = watch('alisLokasyonu');
  const varisLokasyonuValue = watch('varisLokasyonu');
  const kalkisIliValue      = watch('kalkisIli');
  const varisIliValue       = watch('varisIli');
  const tahsisSuresiUnit    = watch('tahsisSuresiUnit');

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
    const msg = buildWhatsAppMessage(data, serviceLabel, activeService, b, lang, customFieldAnswers);
    const waUrl = `https://wa.me/${WA_NUMBER}?text=${msg}`;

    // Persist the request before navigating away. The timeout keeps WhatsApp as
    // the primary journey even if a slow network/database cannot respond.
    try {
      await fetch('/data/submit-request', {
        method:    'POST',
        keepalive: true,
        signal:    AbortSignal.timeout(2500),
        headers:   { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent:           'QUOTE',
          serviceType:      activeService,
          adSoyad:          data.adSoyad,
          telefon:          data.telefon,
          email:            data.email?.trim() ?? null,
          newsletterConsent,
          locale:           lang,
          _hp:              honeypotRef.current?.value ?? '',
          formData:         submittedFormData,
        }),
      });
    } catch {
      // Do not block a visitor from opening WhatsApp. The server keeps its
      // keepalive request when possible and the next submission can be retried.
    }

    // GA4: track every booking form submission with service type and originating page
    trackEvent('reservation_submit', {
      service_type: activeService,
      page_path:    pathname,
    });

    window.location.href = waUrl;
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
              {loadingST ? (
                <div className="h-16 rounded-xl" style={{ background: '#EBF4FF' }} />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label={b.serviceTypeLabel}>
                  {serviceTypes.map((st) => {
                    const isActive  = activeService === st.key;
                    const iconColor = isActive ? SERVICE_ICON_COLORS[st.key] ?? '#C79A35' : '#718596';
                    return (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => { setActiveService(st.key); clearErrors(); }}
                        aria-pressed={isActive}
                        className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C79A35] focus-visible:ring-offset-2"
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
              )}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} data-testid="booking-form" noValidate>
              {/* Honeypot — offscreen + tabIndex=-1 hides from keyboard and AT;
                  aria-hidden removed because WCAG forbids aria-hidden on focusable elements */}
              <input
                ref={honeypotRef}
                type="text"
                name="_hp"
                tabIndex={-1}
                aria-label="Leave this field empty"
                autoComplete="off"
                style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
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
                        <LocationCombobox id="bf-alis-lokasyon" ariaLabel={b.pickupLocation} for="pickup" scope="local" value={field.value ?? ''} onChange={field.onChange}
                          placeholder={b.pickupPlaceholder} loadingText={dict.common.loading} labels={ui.location} error={!!errors.alisLokasyonu} excludeName={varisLokasyonuValue} />
                      )} />
                      {errors.alisLokasyonu && <p role="alert" style={errorStyle}>{errors.alisLokasyonu.message}</p>}
                    </div>
                    <div data-testid="field-varis-lokasyon">
                      <label htmlFor="bf-varis-lokasyon" style={labelStyle}><MapPin size={12} aria-hidden="true" /> {b.dropoffLocation}</label>
                      <Controller control={control} name="varisLokasyonu" render={({ field }) => (
                        <LocationCombobox id="bf-varis-lokasyon" ariaLabel={b.dropoffLocation} for="dropoff" scope="local" value={field.value ?? ''} onChange={field.onChange}
                          placeholder={b.dropoffPlaceholder} loadingText={dict.common.loading} labels={ui.location} error={!!errors.varisLokasyonu} excludeName={alisLokasyonuValue} />
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
                  </>)}

                  {/* INTERCITY */}
                  {activeService === 'INTERCITY' && (<>
                    <div data-testid="field-kalkis-ili">
                      <label htmlFor="bf-kalkis-ili" style={labelStyle}><MapPin size={12} aria-hidden="true" /> {b.departureCity}</label>
                      <Controller control={control} name="kalkisIli" render={({ field }) => (
                        <LocationCombobox id="bf-kalkis-ili" ariaLabel={b.departureCity} for="pickup" scope="intercity" value={field.value ?? ''} onChange={field.onChange}
                          placeholder={b.departureCityPlaceholder} loadingText={dict.common.loading} labels={ui.location} error={!!errors.kalkisIli} excludeName={varisIliValue} />
                      )} />
                      {errors.kalkisIli && <p role="alert" style={errorStyle}>{errors.kalkisIli.message}</p>}
                    </div>
                    <div data-testid="field-varis-ili">
                      <label htmlFor="bf-varis-ili" style={labelStyle}><MapPin size={12} aria-hidden="true" /> {b.arrivalCity}</label>
                      <Controller control={control} name="varisIli" render={({ field }) => (
                        <LocationCombobox id="bf-varis-ili" ariaLabel={b.arrivalCity} for="dropoff" scope="intercity" value={field.value ?? ''} onChange={field.onChange}
                          placeholder={b.arrivalCityPlaceholder} loadingText={dict.common.loading} labels={ui.location} error={!!errors.varisIli} excludeName={kalkisIliValue} />
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
                  </>)}

                  {/* ALLOCATION */}
                  {activeService === 'ALLOCATION' && (<>
                    <div data-testid="field-alis-alloc">
                      <label htmlFor="bf-alis-lokasyon" style={labelStyle}><MapPin size={12} aria-hidden="true" /> {b.allocationLocation}</label>
                      <Controller control={control} name="alisLokasyonu" render={({ field }) => (
                        <LocationCombobox id="bf-alis-lokasyon" ariaLabel={b.allocationLocation} for="pickup" scope="local" value={field.value ?? ''} onChange={field.onChange}
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
                        <LocationCombobox id="bf-alis-lokasyon" ariaLabel={b.allocationLocation} for="pickup" scope="local" value={field.value ?? ''} onChange={field.onChange}
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
                      {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={String(n)}>{n} {b.passengerSuffix}</option>
                      ))}
                    </select>
                    <p style={hintStyle}>{b.vehicleHint}</p>
                  </div>

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
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
