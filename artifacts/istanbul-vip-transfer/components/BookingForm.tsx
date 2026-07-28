'use client';

import { useState, useRef, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  MapPin, Calendar, Clock, Users, User, Phone, Home,
  Plane, ArrowRightLeft, Car, Compass, Mail,
} from 'lucide-react';
import LocationCombobox from './LocationCombobox';

// ── Constants ─────────────────────────────────────────────────────────────────

const WA_NUMBER = '905326600847';

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

// ── Form schema ───────────────────────────────────────────────────────────────

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

const formSchema = z.object({
  tarih:      z.string().min(1, 'Lütfen tarih seçin'),
  saatSaat:   z.string().min(1, 'Lütfen saat seçin'),
  saatDakika: z.string().min(1, 'Lütfen dakika seçin')
    .refine((v) => parseInt(v, 10) % 5 === 0, { message: "Dakika 5'in katı olmalıdır" }),
  yolcuSayisi: z.string().min(1, 'Lütfen yolcu sayısı seçin'),
  adSoyad:     z.string().min(2, 'Lütfen adınızı ve soyadınızı girin'),
  telefon:     z.string().min(10, 'Geçerli bir telefon numarası girin'),
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

type FormData = z.infer<typeof formSchema>;

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
  color:      '#718596',
  fontFamily: 'Inter, sans-serif',
};

const optionalBadge = (
  <span style={{ color: '#718596', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '11px' }}>
    &nbsp;(opsiyonel)
  </span>
);

// Alternating content panels
const panelA: React.CSSProperties = {
  background:    'rgba(235,244,255,0.85)',
  border:        '1px solid rgba(147,197,253,0.5)',
  borderRadius:  '16px',
  padding:       '20px 24px',
  marginBottom:  '12px',
};

const panelB: React.CSSProperties = {
  background:    'rgba(243,239,253,0.85)',
  border:        '1px solid rgba(196,181,253,0.45)',
  borderRadius:  '16px',
  padding:       '20px 24px',
  marginBottom:  '12px',
};

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
): string {
  const saat  = `${data.saatSaat}:${data.saatDakika}`;
  const lines: string[] = [];

  lines.push('Fiyat / Rezervasyon Talebi', `Hizmet: ${serviceLabel}`, '');

  if (activeService === 'AIRPORT_TRANSFER') {
    lines.push(`Alış Lokasyonu: ${data.alisLokasyonu}`);
    if (data.alisAdresi?.trim())  lines.push(`Alış Adresi / Otel: ${data.alisAdresi}`);
    lines.push(`Varış Lokasyonu: ${data.varisLokasyonu}`);
    if (data.varisAdresi?.trim()) lines.push(`Varış Adresi / Otel: ${data.varisAdresi}`);
    lines.push(`Tarih: ${data.tarih}`, `Saat: ${saat}`);

  } else if (activeService === 'INTERCITY') {
    lines.push(`Kalkış İli: ${data.kalkisIli}`);
    if (data.kalkisAdres?.trim()) lines.push(`Kalkış Adresi: ${data.kalkisAdres}`);
    lines.push(`Varış İli: ${data.varisIli}`);
    if (data.varisAdres?.trim())  lines.push(`Varış Adresi: ${data.varisAdres}`);
    lines.push(`Tarih: ${data.tarih}`, `Saat: ${saat}`);

  } else if (activeService === 'ALLOCATION') {
    lines.push(`Alış Lokasyonu: ${data.alisLokasyonu}`);
    if (data.alisAdresi?.trim())  lines.push(`Alış Adresi: ${data.alisAdresi}`);
    lines.push(`Başlangıç Tarihi: ${data.tarih}`, `Başlangıç Saati: ${saat}`);
    if (data.tahsisSuresi) {
      const unit = data.tahsisSuresiUnit === 'GUN' ? 'Gün' : 'Saat';
      lines.push(`Tahsis Süresi: ${data.tahsisSuresi} ${unit}`);
    }
    if (data.rotaAciklama?.trim()) lines.push(`Rota / Kullanım: ${data.rotaAciklama}`);

  } else if (activeService === 'TOUR') {
    lines.push(`Alış Lokasyonu: ${data.alisLokasyonu}`);
    if (data.alisAdresi?.trim())  lines.push(`Alış Adresi / Otel: ${data.alisAdresi}`);
    lines.push(`Talep Edilen Tur / Rota: ${data.talepsRota}`);
    if (data.talepsYerler?.trim()) lines.push(`Ziyaret Edilmek İstenen Yerler: ${data.talepsYerler}`);
    lines.push(`Tarih: ${data.tarih}`, `Başlangıç Saati: ${saat}`);
    if (data.planlananSure?.trim()) {
      const unit = data.planlananSureUnit === 'GUN' ? 'Gün' : 'Saat';
      lines.push(`Planlanan Süre: ${data.planlananSure} ${unit}`);
    }
  }

  lines.push(
    '',
    `Yolcu Sayısı: ${data.yolcuSayisi}`,
    `Ad Soyad: ${data.adSoyad}`,
    `Telefon: ${data.telefon}`,
  );
  if (data.email?.trim()) lines.push(`E-posta: ${data.email.trim()}`);

  return encodeURIComponent(lines.join('\n'));
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BookingForm() {
  const [serviceTypes, setServiceTypes]   = useState<ServiceTypeOption[]>([]);
  const [activeService, setActiveService] = useState('AIRPORT_TRANSFER');
  const [loadingST, setLoadingST]         = useState(true);
  const [submitting, setSubmitting]       = useState(false);
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [newsletterError, setNewsletterError]     = useState('');
  const honeypotRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split('T')[0];

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hizmet = params.get('hizmet');
    if (hizmet && HIZMET_MAP[hizmet]) setActiveService(HIZMET_MAP[hizmet]);
  }, []);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
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

  // ── Service field validation ───────────────────────────────────────────────
  function validateServiceFields(data: FormData): boolean {
    let valid = true;

    if (activeService === 'AIRPORT_TRANSFER') {
      if (!data.alisLokasyonu?.trim()) {
        setError('alisLokasyonu', { message: 'Lütfen kalkış noktasını seçin' }); valid = false;
      }
      if (!data.varisLokasyonu?.trim()) {
        setError('varisLokasyonu', { message: 'Lütfen varış noktasını seçin' }); valid = false;
      }
      if (data.alisLokasyonu && data.varisLokasyonu && data.alisLokasyonu === data.varisLokasyonu) {
        setError('varisLokasyonu', { message: 'Kalkış ve varış aynı lokasyon olamaz' }); valid = false;
      }
    } else if (activeService === 'INTERCITY') {
      if (!data.kalkisIli?.trim()) {
        setError('kalkisIli', { message: 'Lütfen kalkış ilini seçin' }); valid = false;
      }
      if (!data.varisIli?.trim()) {
        setError('varisIli', { message: 'Lütfen varış ilini seçin' }); valid = false;
      }
      if (data.kalkisIli && data.varisIli && data.kalkisIli === data.varisIli) {
        setError('varisIli', { message: 'Kalkış ve varış ili aynı olamaz' }); valid = false;
      }
    } else if (activeService === 'ALLOCATION') {
      if (!data.alisLokasyonu?.trim()) {
        setError('alisLokasyonu', { message: 'Lütfen alış lokasyonunu seçin' }); valid = false;
      }
      const n = parseInt(data.tahsisSuresi ?? '', 10);
      if (!data.tahsisSuresi?.trim() || isNaN(n) || n < 1) {
        setError('tahsisSuresi', { message: 'Lütfen tahsis süresini girin' }); valid = false;
      } else if (data.tahsisSuresiUnit === 'SAAT' && n < 4) {
        setError('tahsisSuresi', { message: 'Minimum tahsis süresi 4 saattir.' }); valid = false;
      } else if (data.tahsisSuresiUnit === 'GUN' && n < 1) {
        setError('tahsisSuresi', { message: 'Minimum tahsis süresi 1 gündür.' }); valid = false;
      }
    } else if (activeService === 'TOUR') {
      if (!data.alisLokasyonu?.trim()) {
        setError('alisLokasyonu', { message: 'Lütfen alış lokasyonunu seçin' }); valid = false;
      }
      if (!data.talepsRota?.trim()) {
        setError('talepsRota', { message: 'Lütfen talep edilen tur / rotayı girin' }); valid = false;
      }
    }

    return valid;
  }

  // ── Submit handler — fire-and-forget DB save, immediate WA redirect ────────
  const onSubmit = async (data: FormData) => {
    if (!validateServiceFields(data)) return;

    if (newsletterConsent && !data.email?.trim()) {
      setNewsletterError('E-posta adresi girilmeden bülten aboneliği yapılamaz.');
      return;
    }
    setNewsletterError('');
    setSubmitting(true);

    const serviceLabel = activeST?.label ?? activeService;
    const msg   = buildWhatsAppMessage(data, serviceLabel, activeService);
    const waUrl = `https://wa.me/${WA_NUMBER}?text=${msg}`;

    // Background save — keepalive keeps the request alive after navigation.
    // Errors are intentionally ignored so the customer is never blocked.
    fetch('/data/submit-request', {
      method:    'POST',
      keepalive: true,
      headers:   { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent:           'QUOTE',
        serviceType:      activeService,
        adSoyad:          data.adSoyad,
        telefon:          data.telefon,
        email:            data.email?.trim() ?? null,
        newsletterConsent,
        _hp:              honeypotRef.current?.value ?? '',
        formData:         data,
      }),
    }).catch(() => {});

    // Redirect same tab — compatible with iOS Safari, Android Chrome, Samsung Internet.
    // wa.me falls back to WhatsApp Web if the app is not installed.
    window.location.href = waUrl;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section
      id="rezervasyon"
      className="py-24 relative"
      style={{ background: 'linear-gradient(160deg, #FDFBF6 0%, #EBF4FF 50%, #F3EFFD 100%)' }}
      data-testid="booking-section"
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: '#D9E2EC' }} aria-hidden="true" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8">

        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
        >
          <span className="text-xs tracking-[0.3em] uppercase mb-4 block" style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}>
            Hızlı Rezervasyon
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}>
            Fiyat ve Rezervasyon Talebi
          </h2>
          <p className="text-base max-w-lg mx-auto" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
            Talebinizi iletin, fiyat ve araç uygunluğu bilgisini WhatsApp üzerinden paylaşalım.
          </p>
        </motion.div>

        {/* Form card */}
        <motion.div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background:  '#FFFFFF',
            border:      '1px solid #D9E2EC',
            boxShadow:   '0 8px 40px rgba(16,42,67,0.08)',
          }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, delay: 0.2 }}
          data-testid="booking-form-card"
        >
          <div className="h-[3px] w-full" style={{ background: 'linear-gradient(90deg, transparent, #C79A35 30%, #E4B84B 50%, #C79A35 70%, transparent)' }} aria-hidden="true" />
          <div className="p-5 sm:p-6 md:p-10 pub-form">

            {/* Panel — Service type */}
            <div style={panelB} data-testid="service-panel">
              <p className="text-xs tracking-[0.18em] uppercase mb-3 font-semibold" style={{ color: '#263F55', fontFamily: 'Inter, sans-serif' }}>
                Hizmet Türü
              </p>
              {loadingST ? (
                <div className="h-16 rounded-xl" style={{ background: '#EBF4FF' }} />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="Hizmet türü">
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
                        <span className="text-center leading-tight">{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} data-testid="booking-form" noValidate>
              {/* Honeypot — hidden from real users */}
              <input
                ref={honeypotRef}
                type="text"
                name="_hp"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
              />

              {/* Panel A — Service-specific fields */}
              <div style={panelA} data-testid="service-fields-panel">
                <p className="text-xs tracking-[0.15em] uppercase mb-4 font-semibold" style={{ color: '#263F55', fontFamily: 'Inter, sans-serif' }}>
                  {activeService === 'AIRPORT_TRANSFER' ? 'Güzergah Bilgileri'
                    : activeService === 'INTERCITY'     ? 'Güzergah Bilgileri'
                    : activeService === 'ALLOCATION'    ? 'Tahsis Bilgileri'
                    : 'Tur Bilgileri'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">

                  {/* AIRPORT_TRANSFER */}
                  {activeService === 'AIRPORT_TRANSFER' && (<>
                    <div data-testid="field-alis-lokasyon">
                      <label style={labelStyle}><MapPin size={12} aria-hidden="true" /> Alış Lokasyonu</label>
                      <Controller control={control} name="alisLokasyonu" render={({ field }) => (
                        <LocationCombobox for="pickup" scope="local" value={field.value ?? ''} onChange={field.onChange}
                          placeholder="Kalkış noktası seçin" error={!!errors.alisLokasyonu} excludeName={varisLokasyonuValue} />
                      )} />
                      {errors.alisLokasyonu && <p role="alert" style={errorStyle}>{errors.alisLokasyonu.message}</p>}
                    </div>
                    <div data-testid="field-varis-lokasyon">
                      <label style={labelStyle}><MapPin size={12} aria-hidden="true" /> Varış Lokasyonu</label>
                      <Controller control={control} name="varisLokasyonu" render={({ field }) => (
                        <LocationCombobox for="dropoff" scope="local" value={field.value ?? ''} onChange={field.onChange}
                          placeholder="Varış noktası seçin" error={!!errors.varisLokasyonu} excludeName={alisLokasyonuValue} />
                      )} />
                      {errors.varisLokasyonu && <p role="alert" style={errorStyle}>{errors.varisLokasyonu.message}</p>}
                    </div>
                    <div>
                      <label style={labelStyle}><Home size={12} aria-hidden="true" /> Alış Adresi / Otel {optionalBadge}</label>
                      <input type="text" {...register('alisAdresi')} className="vip-input"
                        placeholder="Otel veya kesin adres" autoComplete="address-line1" />
                    </div>
                    <div>
                      <label style={labelStyle}><Home size={12} aria-hidden="true" /> Varış Adresi / Otel {optionalBadge}</label>
                      <input type="text" {...register('varisAdresi')} className="vip-input"
                        placeholder="Otel veya kesin adres" autoComplete="off" />
                    </div>
                  </>)}

                  {/* INTERCITY */}
                  {activeService === 'INTERCITY' && (<>
                    <div data-testid="field-kalkis-ili">
                      <label style={labelStyle}><MapPin size={12} aria-hidden="true" /> Kalkış İli</label>
                      <Controller control={control} name="kalkisIli" render={({ field }) => (
                        <LocationCombobox for="pickup" scope="intercity" value={field.value ?? ''} onChange={field.onChange}
                          placeholder="Kalkış ilini seçin" error={!!errors.kalkisIli} excludeName={varisIliValue} />
                      )} />
                      {errors.kalkisIli && <p role="alert" style={errorStyle}>{errors.kalkisIli.message}</p>}
                    </div>
                    <div data-testid="field-varis-ili">
                      <label style={labelStyle}><MapPin size={12} aria-hidden="true" /> Varış İli</label>
                      <Controller control={control} name="varisIli" render={({ field }) => (
                        <LocationCombobox for="dropoff" scope="intercity" value={field.value ?? ''} onChange={field.onChange}
                          placeholder="Varış ilini seçin" error={!!errors.varisIli} excludeName={kalkisIliValue} />
                      )} />
                      {errors.varisIli && <p role="alert" style={errorStyle}>{errors.varisIli.message}</p>}
                    </div>
                    <div>
                      <label style={labelStyle}><Home size={12} aria-hidden="true" /> Kalkış İlçesi / Adresi {optionalBadge}</label>
                      <input type="text" {...register('kalkisAdres')} className="vip-input"
                        placeholder="İlçe veya kesin adres" autoComplete="address-line1" />
                    </div>
                    <div>
                      <label style={labelStyle}><Home size={12} aria-hidden="true" /> Varış İlçesi / Adresi {optionalBadge}</label>
                      <input type="text" {...register('varisAdres')} className="vip-input"
                        placeholder="İlçe veya kesin adres" autoComplete="off" />
                    </div>
                  </>)}

                  {/* ALLOCATION */}
                  {activeService === 'ALLOCATION' && (<>
                    <div data-testid="field-alis-alloc">
                      <label style={labelStyle}><MapPin size={12} aria-hidden="true" /> Alış Lokasyonu</label>
                      <Controller control={control} name="alisLokasyonu" render={({ field }) => (
                        <LocationCombobox for="pickup" scope="local" value={field.value ?? ''} onChange={field.onChange}
                          placeholder="Lokasyon seçin" error={!!errors.alisLokasyonu} />
                      )} />
                      {errors.alisLokasyonu && <p role="alert" style={errorStyle}>{errors.alisLokasyonu.message}</p>}
                    </div>
                    <div>
                      <label style={labelStyle}><Home size={12} aria-hidden="true" /> Alış Adresi {optionalBadge}</label>
                      <input type="text" {...register('alisAdresi')} className="vip-input"
                        placeholder="Kesin adres veya otel" autoComplete="address-line1" />
                    </div>
                    <div data-testid="field-tahsis">
                      <label style={labelStyle}><Clock size={12} aria-hidden="true" /> Tahsis Süresi</label>
                      <div style={durationRowStyle}>
                        <input
                          type="number"
                          min={tahsisSuresiUnit === 'SAAT' ? 4 : 1}
                          step="1"
                          inputMode="numeric"
                          aria-label="Tahsis süresi miktarı"
                          {...register('tahsisSuresi')}
                          className="vip-input"
                          placeholder={tahsisSuresiUnit === 'SAAT' ? 'Min. 4' : 'Min. 1'}
                          style={{ flex: '1 1 0', minWidth: 0 }}
                        />
                        <select
                          aria-label="Tahsis süresi birimi"
                          {...register('tahsisSuresiUnit')}
                          className="vip-input vip-select"
                          style={{ flex: '0 0 100px', width: '100px' }}
                        >
                          <option value="SAAT">Saat</option>
                          <option value="GUN">Gün</option>
                        </select>
                      </div>
                      {errors.tahsisSuresi
                        ? <p role="alert" style={errorStyle}>{errors.tahsisSuresi.message}</p>
                        : tahsisSuresiUnit === 'SAAT'
                          ? <p style={hintStyle}>Minimum tahsis süresi 4 saattir.</p>
                          : null}
                    </div>
                    <div className="md:col-span-2">
                      <label style={labelStyle}><MapPin size={12} aria-hidden="true" /> Planlanan Rota / Kullanım Açıklaması {optionalBadge}</label>
                      <textarea {...register('rotaAciklama')} className="vip-input"
                        placeholder="Hangi güzergahları / etkinlikleri planlıyorsunuz?" rows={2}
                        style={{ width: '100%', resize: 'vertical', minHeight: '72px' }} />
                    </div>
                  </>)}

                  {/* TOUR */}
                  {activeService === 'TOUR' && (<>
                    <div data-testid="field-alis-tour">
                      <label style={labelStyle}><MapPin size={12} aria-hidden="true" /> Alış Lokasyonu</label>
                      <Controller control={control} name="alisLokasyonu" render={({ field }) => (
                        <LocationCombobox for="pickup" scope="local" value={field.value ?? ''} onChange={field.onChange}
                          placeholder="Otel veya lokasyon seçin" error={!!errors.alisLokasyonu} />
                      )} />
                      {errors.alisLokasyonu && <p role="alert" style={errorStyle}>{errors.alisLokasyonu.message}</p>}
                    </div>
                    <div>
                      <label style={labelStyle}><Home size={12} aria-hidden="true" /> Alış Adresi / Otel {optionalBadge}</label>
                      <input type="text" {...register('alisAdresi')} className="vip-input"
                        placeholder="Kesin adres" autoComplete="address-line1" />
                    </div>
                    <div className="md:col-span-2" data-testid="field-rota-tour">
                      <label style={labelStyle}><Compass size={12} aria-hidden="true" /> Talep Edilen Tur / Rota</label>
                      <input type="text" {...register('talepsRota')} className="vip-input"
                        placeholder="ör. Boğaz Turu, Tarihi Yarımada, Prens Adaları" />
                      {errors.talepsRota && <p role="alert" style={errorStyle}>{errors.talepsRota.message}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <label style={labelStyle}><MapPin size={12} aria-hidden="true" /> Ziyaret Edilmek İstenen Yerler {optionalBadge}</label>
                      <textarea {...register('talepsYerler')} className="vip-input"
                        placeholder="ör. Aya Sofya, Topkapı Sarayı, Kapalıçarşı…" rows={2}
                        style={{ width: '100%', resize: 'vertical', minHeight: '72px' }} />
                    </div>
                    <div data-testid="field-sure-tour">
                      <label style={labelStyle}><Clock size={12} aria-hidden="true" /> Planlanan Süre {optionalBadge}</label>
                      <div style={durationRowStyle}>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          aria-label="Planlanan süre miktarı"
                          {...register('planlananSure')}
                          className="vip-input"
                          placeholder="ör. 4"
                          style={{ flex: '1 1 0', minWidth: 0 }}
                        />
                        <select
                          aria-label="Planlanan süre birimi"
                          {...register('planlananSureUnit')}
                          className="vip-input vip-select"
                          style={{ flex: '0 0 100px', width: '100px' }}
                        >
                          <option value="SAAT">Saat</option>
                          <option value="GUN">Gün</option>
                        </select>
                      </div>
                    </div>
                  </>)}

                </div>
              </div>

              {/* Panel B — Date / Time / Passengers */}
              <div style={panelB} data-testid="datetime-panel">
                <p className="text-xs tracking-[0.15em] uppercase mb-4 font-semibold" style={{ color: '#263F55', fontFamily: 'Inter, sans-serif' }}>
                  {activeService === 'ALLOCATION' ? 'Başlangıç ve Yolcu' : 'Tarih, Saat ve Yolcu'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">

                  <div data-testid="field-tarih">
                    <label style={labelStyle}>
                      <Calendar size={12} aria-hidden="true" />
                      {activeService === 'ALLOCATION' ? 'Başlangıç Tarihi' : 'Tarih'}
                    </label>
                    <input type="date" {...register('tarih')} className="vip-input" min={today}
                      style={{ colorScheme: 'light' }} data-testid="input-tarih" />
                    {errors.tarih && <p role="alert" style={errorStyle}>{errors.tarih.message}</p>}
                  </div>

                  <div data-testid="field-saat">
                    <label style={labelStyle}>
                      <Clock size={12} aria-hidden="true" />
                      {activeService === 'ALLOCATION' || activeService === 'TOUR' ? 'Başlangıç Saati' : 'Saat'}
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select {...register('saatSaat')} className="vip-input vip-select" style={{ flex: 1 }}
                        aria-label="Saat" data-testid="input-saat-saat">
                        <option value="">Sa.</option>
                        {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <select {...register('saatDakika')} className="vip-input vip-select" style={{ flex: 1 }}
                        aria-label="Dakika" data-testid="input-saat-dakika">
                        <option value="">Dk.</option>
                        {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    {(errors.saatSaat || errors.saatDakika) && (
                      <p role="alert" style={errorStyle}>{errors.saatSaat?.message ?? errors.saatDakika?.message}</p>
                    )}
                  </div>

                  <div data-testid="field-yolcu">
                    <label style={labelStyle}><Users size={12} aria-hidden="true" /> Yolcu Sayısı</label>
                    <select {...register('yolcuSayisi')} className="vip-input vip-select" data-testid="input-yolcu">
                      {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={String(n)}>{n} Yolcu</option>
                      ))}
                    </select>
                    <p style={hintStyle}>Araç planlaması WhatsApp üzerinden teyit edilir.</p>
                  </div>

                </div>
              </div>

              {/* Panel A — Contact */}
              <div style={panelA} data-testid="contact-panel">
                <p className="text-xs tracking-[0.15em] uppercase mb-4 font-semibold" style={{ color: '#263F55', fontFamily: 'Inter, sans-serif' }}>
                  İletişim Bilgileri
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                  <div data-testid="field-adsoyad">
                    <label style={labelStyle}><User size={12} aria-hidden="true" /> Ad Soyad</label>
                    <input type="text" {...register('adSoyad')} className="vip-input"
                      placeholder="Adınız ve soyadınız" autoComplete="name"
                      inputMode="text" data-testid="input-adsoyad" />
                    {errors.adSoyad && <p role="alert" style={errorStyle}>{errors.adSoyad.message}</p>}
                  </div>
                  <div data-testid="field-telefon">
                    <label style={labelStyle}><Phone size={12} aria-hidden="true" /> Telefon</label>
                    <input type="tel" {...register('telefon')} className="vip-input"
                      placeholder="+90 5__ ___ __ __" autoComplete="tel"
                      inputMode="tel" data-testid="input-telefon" />
                    {errors.telefon && <p role="alert" style={errorStyle}>{errors.telefon.message}</p>}
                  </div>
                </div>
              </div>

              {/* Panel B — Email + Newsletter */}
              <div style={panelB} data-testid="email-panel">
                <div className="grid grid-cols-1 gap-4">
                  <div data-testid="field-email">
                    <label style={labelStyle}><Mail size={12} aria-hidden="true" /> E-posta {optionalBadge}</label>
                    <input type="email" {...register('email')} className="vip-input"
                      placeholder="ornek@email.com" autoComplete="email" inputMode="email"
                      style={{ maxWidth: '420px' }} />
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
                        Kampanya, yeni hizmet, gezi ve blog içeriklerini e-posta ile almak istiyorum.{' '}
                        <a href="/kvkk" target="_blank" rel="noopener noreferrer"
                          style={{ color: '#2563EB', textDecoration: 'underline' }}>
                          Aydınlatma Metni
                        </a>{' '}
                        ve{' '}
                        <a href="/ticari-iletisim" target="_blank" rel="noopener noreferrer"
                          style={{ color: '#2563EB', textDecoration: 'underline' }}>
                          Ticari İletişim Bilgilendirmesi
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
                  <strong>Önemli:</strong> Fiyat, araç uygunluğu ve rezervasyon onayı WhatsApp üzerinden tarafımızca teyit edilir.
                </p>
              </div>

              {/* Submit */}
              <div className="text-center">
                <motion.button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-3 w-full sm:w-auto px-8 sm:px-10 py-4 rounded-xl text-sm font-semibold tracking-wider uppercase transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#C79A35] disabled:opacity-70 disabled:cursor-not-allowed"
                  style={{
                    background:    '#25D366',
                    color:         '#FFFFFF',
                    fontFamily:    'Inter, sans-serif',
                    letterSpacing: '0.05em',
                    minHeight:     '56px',
                    minWidth:      '260px',
                    maxWidth:      '100%',
                    touchAction:   'manipulation',
                  }}
                  whileTap={{ scale: 0.98 }}
                  data-testid="booking-submit-button"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                      Yönlendiriliyor…
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                      </svg>
                      WhatsApp&apos;tan Fiyat / Rezervasyon Talebi Gönder
                    </>
                  )}
                </motion.button>
                <p className="mt-4 text-xs" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
                  Mesajınız doğrudan WhatsApp&apos;a iletilir. Ek ücret yoktur.
                </p>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
