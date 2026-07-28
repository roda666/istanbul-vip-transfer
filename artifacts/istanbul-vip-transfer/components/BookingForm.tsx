'use client';

import { useState, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  MapPin, Calendar, Clock, Users, User, Phone, Home,
  Plane, ArrowRightLeft, Car, Compass, FileText, Mail, Luggage, Baby,
} from 'lucide-react';
import { bookingWhatsAppUrl } from '@/lib/site-config';
import LocationCombobox from './LocationCombobox';

// ── Service type definitions ──────────────────────────────────────────────────

interface ServiceTypeOption {
  id: string;
  key: string;
  label: string;
  description: string | null;
  quoteEnabled: boolean;
  reservationEnabled: boolean;
}

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  AIRPORT_TRANSFER: <Plane size={20} aria-hidden="true" />,
  INTERCITY:        <ArrowRightLeft size={20} aria-hidden="true" />,
  ALLOCATION:       <Car size={20} aria-hidden="true" />,
  TOUR:             <Compass size={20} aria-hidden="true" />,
};

// URL param → service type key mapping
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
  // ── Required common ──
  tarih:       z.string().min(1, 'Lütfen tarih seçin'),
  saatSaat:    z.string().min(1, 'Lütfen saat seçin'),
  saatDakika:  z.string().min(1, 'Lütfen dakika seçin')
    .refine((v) => parseInt(v, 10) % 5 === 0, { message: "Dakika 5'in katı olmalıdır" }),
  yolcuSayisi: z.string().min(1, 'Lütfen yolcu sayısı seçin'),
  adSoyad:     z.string().min(2, 'Lütfen adınızı ve soyadınızı girin'),
  telefon:     z.string().min(10, 'Geçerli bir telefon numarası girin'),
  notlar:      z.string().optional(),

  // ── Optional shared ──
  email:        z.string().optional(),
  bagajSayisi:  z.string().optional(),
  cocukKoltugu: z.string().optional(),
  aracTercihi:  z.enum(['FARKETMEZ', 'MERCEDES_VITO', 'MERCEDES_SPRINTER', 'VW_TRANSPORTER']).default('FARKETMEZ'),

  // ── AIRPORT_TRANSFER / ALLOCATION / TOUR — location fields ──
  alisLokasyonu: z.string().optional(),
  alisAdresi:    z.string().optional(),
  varisLokasyonu: z.string().optional(),
  varisAdresi:    z.string().optional(),
  ucusNumarasi:   z.string().optional(),

  // ── INTERCITY ──
  kalkisIli:        z.string().optional(),
  kalkisAdres:      z.string().optional(),
  varisIli:         z.string().optional(),
  varisAdres:       z.string().optional(),
  yon:              z.enum(['TEK_YON', 'GIDIS_DONUS']).default('TEK_YON'),
  donusTarih:       z.string().optional(),
  donusSaatSaat:    z.string().optional(),
  donusSaatDakika:  z.string().optional(),

  // ── ALLOCATION ──
  tahsisSuresi:     z.string().optional(),
  tahsisSuresiUnit: z.enum(['SAAT', 'GUN']).default('SAAT'),
  rotaAciklama:     z.string().optional(),

  // ── TOUR ──
  talepsRota:        z.string().optional(),
  talepsYerler:      z.string().optional(),
  planlananSure:     z.string().optional(),
  planlananSureUnit: z.enum(['SAAT', 'GUN']).default('SAAT'),
});

type FormData = z.infer<typeof formSchema>;

// ── Style helpers ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '11px',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  marginBottom: '10px',
  fontWeight: 700,
  color: '#263F55',
  fontFamily: 'Inter, sans-serif',
};

const errorStyle: React.CSSProperties = {
  marginTop: '6px',
  fontSize: '12px',
  color: '#DC2626',
  fontFamily: 'Inter, sans-serif',
};

const hintStyle: React.CSSProperties = {
  marginTop: '4px',
  fontSize: '11px',
  color: '#718596',
  fontFamily: 'Inter, sans-serif',
};

const optionalBadge = (
  <span style={{ color: '#718596', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '11px' }}>
    &nbsp;(opsiyonel)
  </span>
);

// Duration row used by both ALLOCATION and TOUR
const durationRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  alignItems: 'stretch',
};

// ── Main component ────────────────────────────────────────────────────────────

export default function BookingForm() {
  const [intent, setIntent] = useState<'QUOTE' | 'RESERVATION'>('QUOTE');
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeOption[]>([]);
  const [activeService, setActiveService] = useState('AIRPORT_TRANSFER');
  const [loadingST, setLoadingST] = useState(true);

  // Today's date string for min= on date inputs (prevents selecting past dates)
  const today = new Date().toISOString().split('T')[0];

  // Load service types from admin-managed API
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

  // Read ?hizmet= URL param to preselect service
  useEffect(() => {
    if (typeof window === 'undefined') return;
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
      yon:               'TEK_YON',
      tahsisSuresiUnit:  'SAAT',
      planlananSureUnit: 'SAAT',
      aracTercihi:       'FARKETMEZ',
    },
  });

  const yon                 = watch('yon');
  const alisLokasyonuValue  = watch('alisLokasyonu');
  const varisLokasyonuValue = watch('varisLokasyonu');
  const kalkisIliValue      = watch('kalkisIli');
  const varisIliValue       = watch('varisIli');

  const activeST = serviceTypes.find((s) => s.key === activeService);

  // ── Service-specific validation ──────────────────────────────────────────────
  function validateServiceFields(data: FormData): boolean {
    let valid = true;

    if (activeService === 'AIRPORT_TRANSFER') {
      if (!data.alisLokasyonu?.trim()) {
        setError('alisLokasyonu', { message: 'Lütfen kalkış noktasını seçin' });
        valid = false;
      }
      if (!data.varisLokasyonu?.trim()) {
        setError('varisLokasyonu', { message: 'Lütfen varış noktasını seçin' });
        valid = false;
      }
      if (data.alisLokasyonu && data.varisLokasyonu && data.alisLokasyonu === data.varisLokasyonu) {
        setError('varisLokasyonu', { message: 'Kalkış ve varış aynı lokasyon olamaz' });
        valid = false;
      }
    } else if (activeService === 'INTERCITY') {
      if (!data.kalkisIli?.trim()) {
        setError('kalkisIli', { message: 'Lütfen kalkış ilini seçin' });
        valid = false;
      }
      if (!data.varisIli?.trim()) {
        setError('varisIli', { message: 'Lütfen varış ilini seçin' });
        valid = false;
      }
      if (data.kalkisIli && data.varisIli && data.kalkisIli === data.varisIli) {
        setError('varisIli', { message: 'Kalkış ve varış ili aynı olamaz' });
        valid = false;
      }
      if (data.yon === 'GIDIS_DONUS' && !data.donusTarih?.trim()) {
        setError('donusTarih', { message: 'Lütfen dönüş tarihini seçin' });
        valid = false;
      }
    } else if (activeService === 'ALLOCATION') {
      if (!data.alisLokasyonu?.trim()) {
        setError('alisLokasyonu', { message: 'Lütfen alış lokasyonunu seçin' });
        valid = false;
      }
      if (!data.tahsisSuresi?.trim()) {
        setError('tahsisSuresi', { message: 'Lütfen tahsis süresini girin' });
        valid = false;
      }
    } else if (activeService === 'TOUR') {
      if (!data.alisLokasyonu?.trim()) {
        setError('alisLokasyonu', { message: 'Lütfen alış lokasyonunu seçin' });
        valid = false;
      }
      if (!data.talepsRota?.trim()) {
        setError('talepsRota', { message: 'Lütfen talep edilen tur / rotayı girin' });
        valid = false;
      }
    }

    return valid;
  }

  // ── WhatsApp message builder ─────────────────────────────────────────────────
  const onSubmit = (data: FormData) => {
    if (!validateServiceFields(data)) return;

    const saat         = `${data.saatSaat}:${data.saatDakika}`;
    const intentLabel  = intent === 'QUOTE' ? 'Fiyat Teklifi' : 'Rezervasyon Talebi';
    const serviceLabel = activeST?.label ?? activeService;

    const lines: string[] = [
      `Talep Amacı: ${intentLabel}`,
      `Hizmet: ${serviceLabel}`,
      '',
    ];

    if (activeService === 'AIRPORT_TRANSFER') {
      lines.push(`Alış Lokasyonu: ${data.alisLokasyonu}`);
      if (data.alisAdresi?.trim())    lines.push(`Alış Adresi / Otel: ${data.alisAdresi}`);
      lines.push(`Varış Lokasyonu: ${data.varisLokasyonu}`);
      if (data.varisAdresi?.trim())   lines.push(`Varış Adresi / Otel: ${data.varisAdresi}`);
      if (data.ucusNumarasi?.trim())  lines.push(`Uçuş Numarası: ${data.ucusNumarasi}`);
      lines.push(`Tarih: ${data.tarih}`, `Saat: ${saat}`);

    } else if (activeService === 'INTERCITY') {
      lines.push(`Kalkış İli: ${data.kalkisIli}`);
      if (data.kalkisAdres?.trim())  lines.push(`Kalkış Adresi: ${data.kalkisAdres}`);
      lines.push(`Varış İli: ${data.varisIli}`);
      if (data.varisAdres?.trim())   lines.push(`Varış Adresi: ${data.varisAdres}`);
      lines.push(`Yön: ${data.yon === 'TEK_YON' ? 'Tek Yön' : 'Gidiş-Dönüş'}`);
      lines.push(`Gidiş Tarihi: ${data.tarih}`, `Gidiş Saati: ${saat}`);
      if (data.yon === 'GIDIS_DONUS') {
        lines.push(`Dönüş Tarihi: ${data.donusTarih}`);
        if (data.donusSaatSaat && data.donusSaatDakika) {
          lines.push(`Dönüş Saati: ${data.donusSaatSaat}:${data.donusSaatDakika}`);
        }
      }

    } else if (activeService === 'ALLOCATION') {
      lines.push(`Alış Lokasyonu: ${data.alisLokasyonu}`);
      if (data.alisAdresi?.trim()) lines.push(`Alış Adresi: ${data.alisAdresi}`);
      lines.push(`Başlangıç Tarihi: ${data.tarih}`, `Başlangıç Saati: ${saat}`);
      if (data.tahsisSuresi) {
        lines.push(`Tahsis Süresi: ${data.tahsisSuresi} ${data.tahsisSuresiUnit === 'GUN' ? 'Gün' : 'Saat'}`);
      }
      if (data.rotaAciklama?.trim()) lines.push(`Rota / Kullanım: ${data.rotaAciklama}`);

    } else if (activeService === 'TOUR') {
      lines.push(`Alış Lokasyonu: ${data.alisLokasyonu}`);
      if (data.alisAdresi?.trim())     lines.push(`Alış Adresi / Otel: ${data.alisAdresi}`);
      lines.push(`Talep Edilen Tur / Rota: ${data.talepsRota}`);
      if (data.talepsYerler?.trim())   lines.push(`Ziyaret Edilmek İstenen Yerler: ${data.talepsYerler}`);
      lines.push(`Tarih: ${data.tarih}`, `Başlangıç Saati: ${saat}`);
      if (data.planlananSure?.trim()) {
        const unit = data.planlananSureUnit === 'GUN' ? 'Gün' : 'Saat';
        lines.push(`Planlanan Süre: ${data.planlananSure} ${unit}`);
      }
    }

    lines.push('', `Yolcu Sayısı: ${data.yolcuSayisi}`, `Ad Soyad: ${data.adSoyad}`, `Telefon: ${data.telefon}`);

    // Optional shared fields
    if (data.email?.trim())                                     lines.push(`E-posta: ${data.email.trim()}`);
    if (data.bagajSayisi?.trim() && data.bagajSayisi !== '0')   lines.push(`Bagaj Sayısı: ${data.bagajSayisi}`);
    if (data.cocukKoltugu?.trim() && data.cocukKoltugu !== '0') lines.push(`Çocuk Koltuğu: ${data.cocukKoltugu}`);
    if (data.aracTercihi && data.aracTercihi !== 'FARKETMEZ') {
      const aracLabels: Record<string, string> = {
        MERCEDES_VITO:      'Mercedes Vito',
        MERCEDES_SPRINTER:  'Mercedes Sprinter',
        VW_TRANSPORTER:     'VW Transporter',
      };
      lines.push(`Araç Tercihi (Talep): ${aracLabels[data.aracTercihi] ?? data.aracTercihi}`);
    }

    if (data.notlar?.trim()) lines.push(`Notlar: ${data.notlar}`);

    if (intent === 'RESERVATION') {
      lines.push('', 'Not: Rezervasyon talebi olup uygunluk ve fiyat WhatsApp üzerinden ayrıca teyit edilecektir.');
    }

    const message = encodeURIComponent(lines.join('\n'));
    window.open(bookingWhatsAppUrl(message), '_blank');
  };

  const submitLabel = intent === 'QUOTE'
    ? "WhatsApp'tan Fiyat Teklifi Al"
    : "WhatsApp'tan Rezervasyon Talebi Gönder";

  return (
    <section
      id="rezervasyon"
      className="py-24 relative"
      style={{ background: '#F7F8FC' }}
      data-testid="booking-section"
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: '#D9E2EC' }} aria-hidden="true" />
      <div className="max-w-5xl mx-auto px-5 md:px-8">

        {/* Section header */}
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
          <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}>
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
            background: '#FFFFFF',
            border: '1px solid #D9E2EC',
            boxShadow: '0 8px 40px rgba(16,42,67,0.08)',
          }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, delay: 0.2 }}
          data-testid="booking-form-card"
        >
          {/* Gold accent strip */}
          <div className="h-[3px] w-full" style={{ background: 'linear-gradient(90deg, transparent, #C79A35 30%, #E4B84B 50%, #C79A35 70%, transparent)' }} aria-hidden="true" />

          {/* pub-form enables the light-theme .vip-input overrides from globals.css */}
          <div className="p-6 md:p-10 pub-form">

            {/* ── Intent selector ── */}
            <div className="mb-8" data-testid="intent-selector">
              <p className="text-xs tracking-[0.18em] uppercase mb-3 font-semibold" style={{ color: '#263F55', fontFamily: 'Inter, sans-serif' }}>
                Ne yapmak istiyorsunuz?
              </p>
              <div className="flex flex-col sm:flex-row gap-2" role="group" aria-label="Talep amacı">
                {(['QUOTE', 'RESERVATION'] as const).map((opt) => {
                  const label    = opt === 'QUOTE' ? 'Fiyat Teklifi Al' : 'Rezervasyon Talebi Gönder';
                  const isActive = intent === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setIntent(opt)}
                      aria-pressed={isActive}
                      className="flex-1 py-3 px-5 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
                      style={{
                        border: isActive ? '2px solid #2563EB' : '2px solid #D9E2EC',
                        background: isActive ? '#EBF4FF' : '#FFFFFF',
                        color: isActive ? '#1D4ED8' : '#50677A',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Service type selector ── */}
            <div className="mb-8" data-testid="service-type-selector">
              <p className="text-xs tracking-[0.18em] uppercase mb-3 font-semibold" style={{ color: '#263F55', fontFamily: 'Inter, sans-serif' }}>
                Hizmet Türü
              </p>
              {loadingST ? (
                <div className="h-16 rounded-xl" style={{ background: '#F3F6FA', animation: 'pulse 1.5s infinite' }} />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2" role="group" aria-label="Hizmet türü">
                  {serviceTypes.map((st) => {
                    const isActive = activeService === st.key;
                    return (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => { setActiveService(st.key); clearErrors(); }}
                        aria-pressed={isActive}
                        className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C79A35] focus-visible:ring-offset-2"
                        style={{
                          border:     isActive ? '2px solid #C79A35' : '2px solid #D9E2EC',
                          background: isActive ? 'rgba(199,154,53,0.07)' : '#FFFFFF',
                          color:      isActive ? '#102A43' : '#50677A',
                          fontFamily: 'Inter, sans-serif',
                          minHeight:  '64px',
                        }}
                        data-testid={`service-type-${st.key}`}
                      >
                        <span style={{ color: isActive ? '#C79A35' : '#718596' }}>
                          {SERVICE_ICONS[st.key] ?? <MapPin size={20} />}
                        </span>
                        <span className="text-center leading-tight">{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="mb-8 h-px" style={{ background: '#E8EFF6' }} />

            <form onSubmit={handleSubmit(onSubmit)} data-testid="booking-form" noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* ════════════════════════════════════════════════════════
                    AIRPORT_TRANSFER fields
                ════════════════════════════════════════════════════════ */}
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

                  <div data-testid="field-alis-adres">
                    <label style={labelStyle}><Home size={12} aria-hidden="true" /> Alış Adresi / Otel {optionalBadge}</label>
                    <input type="text" {...register('alisAdresi')} className="vip-input" placeholder="Otel veya kesin adres" />
                  </div>

                  <div data-testid="field-varis-adres">
                    <label style={labelStyle}><Home size={12} aria-hidden="true" /> Varış Adresi / Otel {optionalBadge}</label>
                    <input type="text" {...register('varisAdresi')} className="vip-input" placeholder="Otel veya kesin adres" />
                  </div>

                  <div className="md:col-span-2" data-testid="field-ucus">
                    <label style={labelStyle}><Plane size={12} aria-hidden="true" /> Uçuş Numarası {optionalBadge}</label>
                    <input type="text" {...register('ucusNumarasi')} className="vip-input" placeholder="ör. TK 123" style={{ maxWidth: '260px' }} />
                  </div>
                </>)}

                {/* ════════════════════════════════════════════════════════
                    INTERCITY fields
                ════════════════════════════════════════════════════════ */}
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

                  <div data-testid="field-kalkis-adres">
                    <label style={labelStyle}><Home size={12} aria-hidden="true" /> Kalkış İlçesi / Adresi {optionalBadge}</label>
                    <input type="text" {...register('kalkisAdres')} className="vip-input" placeholder="İlçe veya kesin adres" />
                  </div>

                  <div data-testid="field-varis-adres-intercity">
                    <label style={labelStyle}><Home size={12} aria-hidden="true" /> Varış İlçesi / Adresi {optionalBadge}</label>
                    <input type="text" {...register('varisAdres')} className="vip-input" placeholder="İlçe veya kesin adres" />
                  </div>

                  {/* Yön selector */}
                  <div className="md:col-span-2" data-testid="field-yon">
                    <label style={labelStyle}><ArrowRightLeft size={12} aria-hidden="true" /> Seyahat Yönü</label>
                    <div className="flex gap-2" role="group" aria-label="Seyahat yönü">
                      {([['TEK_YON', 'Tek Yön'], ['GIDIS_DONUS', 'Gidiş-Dönüş']] as const).map(([val, lbl]) => (
                        <label key={val} style={{
                          display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                          padding: '10px 18px', borderRadius: '10px',
                          border:      `2px solid ${yon === val ? '#2563EB' : '#D9E2EC'}`,
                          background:  yon === val ? '#EBF4FF' : '#FFFFFF',
                          color:       yon === val ? '#1D4ED8' : '#50677A',
                          fontSize: '13px', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                        }}>
                          <input type="radio" {...register('yon')} value={val} style={{ accentColor: '#2563EB' }} />
                          {lbl}
                        </label>
                      ))}
                    </div>
                  </div>
                </>)}

                {/* ════════════════════════════════════════════════════════
                    ALLOCATION fields
                ════════════════════════════════════════════════════════ */}
                {activeService === 'ALLOCATION' && (<>
                  <div data-testid="field-alis-alloc">
                    <label style={labelStyle}><MapPin size={12} aria-hidden="true" /> Alış Lokasyonu</label>
                    <Controller control={control} name="alisLokasyonu" render={({ field }) => (
                      <LocationCombobox for="pickup" scope="local" value={field.value ?? ''} onChange={field.onChange}
                        placeholder="Lokasyon seçin" error={!!errors.alisLokasyonu} />
                    )} />
                    {errors.alisLokasyonu && <p role="alert" style={errorStyle}>{errors.alisLokasyonu.message}</p>}
                  </div>

                  <div data-testid="field-alis-adres-alloc">
                    <label style={labelStyle}><Home size={12} aria-hidden="true" /> Alış Adresi {optionalBadge}</label>
                    <input type="text" {...register('alisAdresi')} className="vip-input" placeholder="Kesin adres veya otel" />
                  </div>

                  <div data-testid="field-tahsis">
                    <label style={labelStyle}><Clock size={12} aria-hidden="true" /> Tahsis Süresi</label>
                    {/* Fixed layout: number input takes remaining space, select has fixed width */}
                    <div style={durationRowStyle}>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        aria-label="Tahsis süresi miktarı"
                        {...register('tahsisSuresi')}
                        className="vip-input"
                        placeholder="ör. 4"
                        style={{ flex: '1 1 0', minWidth: 0 }}
                      />
                      <select
                        aria-label="Tahsis süresi birimi"
                        {...register('tahsisSuresiUnit')}
                        className="vip-input vip-select"
                        style={{ flex: '0 0 110px', width: '110px' }}
                      >
                        <option value="SAAT">Saat</option>
                        <option value="GUN">Gün</option>
                      </select>
                    </div>
                    {errors.tahsisSuresi && <p role="alert" style={errorStyle}>{errors.tahsisSuresi.message}</p>}
                  </div>

                  <div data-testid="field-rota" className="md:col-span-2">
                    <label style={labelStyle}><FileText size={12} aria-hidden="true" /> Planlanan Rota / Kullanım Açıklaması {optionalBadge}</label>
                    <textarea {...register('rotaAciklama')} className="vip-input" placeholder="Hangi güzergahları / etkinlikleri planlıyorsunuz?" rows={2}
                      style={{ width: '100%', resize: 'vertical', minHeight: '72px' }} />
                  </div>
                </>)}

                {/* ════════════════════════════════════════════════════════
                    TOUR fields
                ════════════════════════════════════════════════════════ */}
                {activeService === 'TOUR' && (<>
                  <div data-testid="field-alis-tour">
                    <label style={labelStyle}><MapPin size={12} aria-hidden="true" /> Alış Lokasyonu</label>
                    <Controller control={control} name="alisLokasyonu" render={({ field }) => (
                      <LocationCombobox for="pickup" scope="local" value={field.value ?? ''} onChange={field.onChange}
                        placeholder="Otel veya lokasyon seçin" error={!!errors.alisLokasyonu} />
                    )} />
                    {errors.alisLokasyonu && <p role="alert" style={errorStyle}>{errors.alisLokasyonu.message}</p>}
                  </div>

                  <div data-testid="field-alis-adres-tour">
                    <label style={labelStyle}><Home size={12} aria-hidden="true" /> Alış Adresi / Otel {optionalBadge}</label>
                    <input type="text" {...register('alisAdresi')} className="vip-input" placeholder="Kesin adres" />
                  </div>

                  <div className="md:col-span-2" data-testid="field-rota-tour">
                    <label style={labelStyle}><Compass size={12} aria-hidden="true" /> Talep Edilen Tur / Rota</label>
                    <input type="text" {...register('talepsRota')} className="vip-input" placeholder="ör. Boğaz Turu, Tarihi Yarımada, Prens Adaları" />
                    {errors.talepsRota && <p role="alert" style={errorStyle}>{errors.talepsRota.message}</p>}
                  </div>

                  <div className="md:col-span-2" data-testid="field-yerler">
                    <label style={labelStyle}><MapPin size={12} aria-hidden="true" /> Ziyaret Edilmek İstenen Yerler {optionalBadge}</label>
                    <textarea {...register('talepsYerler')} className="vip-input" placeholder="ör. Aya Sofya, Topkapı Sarayı, Kapalıçarşı…" rows={2}
                      style={{ width: '100%', resize: 'vertical', minHeight: '72px' }} />
                  </div>

                  <div data-testid="field-sure-tour">
                    <label style={labelStyle}><Clock size={12} aria-hidden="true" /> Planlanan Süre {optionalBadge}</label>
                    <div style={durationRowStyle}>
                      <input
                        type="number"
                        min="1"
                        step="1"
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
                        style={{ flex: '0 0 110px', width: '110px' }}
                      >
                        <option value="SAAT">Saat</option>
                        <option value="GUN">Gün</option>
                      </select>
                    </div>
                  </div>
                </>)}

                {/* ════════════════════════════════════════════════════════
                    Common: Date + Time (primary)
                ════════════════════════════════════════════════════════ */}
                <div data-testid="field-tarih">
                  <label style={labelStyle}>
                    <Calendar size={12} aria-hidden="true" />
                    {activeService === 'ALLOCATION' ? 'Başlangıç Tarihi'
                      : activeService === 'TOUR'      ? 'Tarih'
                      : activeService === 'INTERCITY' ? 'Gidiş Tarihi'
                      : 'Tarih'}
                  </label>
                  <input
                    type="date"
                    {...register('tarih')}
                    className="vip-input"
                    min={today}
                    style={{ colorScheme: 'light' }}
                    data-testid="input-tarih"
                  />
                  {errors.tarih && <p role="alert" style={errorStyle}>{errors.tarih.message}</p>}
                </div>

                <div data-testid="field-saat">
                  <label style={labelStyle}>
                    <Clock size={12} aria-hidden="true" />
                    {activeService === 'ALLOCATION' || activeService === 'TOUR' ? 'Başlangıç Saati'
                      : activeService === 'INTERCITY' ? 'Gidiş Saati'
                      : 'Saat'}
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <select {...register('saatSaat')} className="vip-input vip-select" style={{ width: '100%' }} data-testid="input-saat-saat" aria-label="Saat">
                        <option value="">Sa.</option>
                        {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <select {...register('saatDakika')} className="vip-input vip-select" style={{ width: '100%' }} data-testid="input-saat-dakika" aria-label="Dakika">
                        <option value="">Dk.</option>
                        {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  {(errors.saatSaat || errors.saatDakika) && (
                    <p role="alert" style={errorStyle}>{errors.saatSaat?.message ?? errors.saatDakika?.message}</p>
                  )}
                </div>

                {/* Intercity: return date/time — shown only when Gidiş-Dönüş selected */}
                {activeService === 'INTERCITY' && yon === 'GIDIS_DONUS' && (<>
                  <div data-testid="field-donus-tarih">
                    <label style={labelStyle}><Calendar size={12} aria-hidden="true" /> Dönüş Tarihi</label>
                    <input type="date" {...register('donusTarih')} className="vip-input" min={today} style={{ colorScheme: 'light' }} />
                    {errors.donusTarih && <p role="alert" style={errorStyle}>{errors.donusTarih.message}</p>}
                  </div>
                  <div data-testid="field-donus-saat">
                    <label style={labelStyle}><Clock size={12} aria-hidden="true" /> Dönüş Saati {optionalBadge}</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select {...register('donusSaatSaat')} className="vip-input vip-select" style={{ flex: 1, width: '100%' }} aria-label="Dönüş saati">
                        <option value="">Sa.</option>
                        {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <select {...register('donusSaatDakika')} className="vip-input vip-select" style={{ flex: 1, width: '100%' }} aria-label="Dönüş dakikası">
                        <option value="">Dk.</option>
                        {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                </>)}

                {/* ── Yolcu Sayısı ── */}
                <div data-testid="field-yolcu">
                  <label style={labelStyle}><Users size={12} aria-hidden="true" /> Yolcu Sayısı</label>
                  <select {...register('yolcuSayisi')} className="vip-input vip-select" data-testid="input-yolcu">
                    {[1,2,3,4,5,6,7,8,9,10,11,12,13].map((n) => (
                      <option key={n} value={String(n)}>{n} Yolcu</option>
                    ))}
                  </select>
                </div>

                {/* ── Ad Soyad ── */}
                <div data-testid="field-adsoyad">
                  <label style={labelStyle}><User size={12} aria-hidden="true" /> Ad Soyad</label>
                  <input type="text" {...register('adSoyad')} className="vip-input" placeholder="Adınız ve soyadınız"
                    autoComplete="name" data-testid="input-adsoyad" />
                  {errors.adSoyad && <p role="alert" style={errorStyle}>{errors.adSoyad.message}</p>}
                </div>

                {/* ── Telefon ── */}
                <div data-testid="field-telefon">
                  <label style={labelStyle}><Phone size={12} aria-hidden="true" /> Telefon</label>
                  <input type="tel" {...register('telefon')} className="vip-input" placeholder="+90 5__ ___ __ __"
                    autoComplete="tel" data-testid="input-telefon" />
                  {errors.telefon && <p role="alert" style={errorStyle}>{errors.telefon.message}</p>}
                </div>

                {/* ── E-posta (shared optional) ── */}
                <div data-testid="field-email">
                  <label style={labelStyle}><Mail size={12} aria-hidden="true" /> E-posta {optionalBadge}</label>
                  <input type="email" {...register('email')} className="vip-input"
                    placeholder="ornek@email.com" autoComplete="email" />
                </div>

                {/* ── Bagaj Sayısı (shared optional) ── */}
                <div data-testid="field-bagaj">
                  <label style={labelStyle}><Luggage size={12} aria-hidden="true" /> Bagaj Sayısı {optionalBadge}</label>
                  <select {...register('bagajSayisi')} className="vip-input vip-select">
                    <option value="">Seçin…</option>
                    {[0,1,2,3,4,5,6,7,8,9,10].map((n) => (
                      <option key={n} value={String(n)}>{n}</option>
                    ))}
                  </select>
                </div>

                {/* ── Çocuk Koltuğu (shared optional) ── */}
                <div data-testid="field-cocuk">
                  <label style={labelStyle}><Baby size={12} aria-hidden="true" /> Çocuk Koltuğu Sayısı {optionalBadge}</label>
                  <select {...register('cocukKoltugu')} className="vip-input vip-select">
                    <option value="">Seçin…</option>
                    {[0,1,2,3].map((n) => (
                      <option key={n} value={String(n)}>{n}</option>
                    ))}
                  </select>
                </div>

                {/* ── Araç Tercihi (shared optional) ── */}
                <div data-testid="field-arac-tercihi">
                  <label style={labelStyle}><Car size={12} aria-hidden="true" /> Araç Tercihi {optionalBadge}</label>
                  <select {...register('aracTercihi')} className="vip-input vip-select">
                    <option value="FARKETMEZ">Fark Etmez</option>
                    <option value="MERCEDES_VITO">Mercedes Vito</option>
                    <option value="MERCEDES_SPRINTER">Mercedes Sprinter</option>
                    <option value="VW_TRANSPORTER">VW Transporter</option>
                  </select>
                  <p style={hintStyle}>Araç tercihi talep niteliğindedir; kesin tahsis teyidle birlikte bildirilir.</p>
                </div>

                {/* ── Ek Notlar ── */}
                <div className="md:col-span-2" data-testid="field-notlar">
                  <label style={labelStyle}><FileText size={12} aria-hidden="true" /> Ek Notlar {optionalBadge}</label>
                  <textarea {...register('notlar')} className="vip-input" placeholder="Özel istekler, ek bilgiler…" rows={2}
                    style={{ width: '100%', resize: 'vertical', minHeight: '72px' }} />
                </div>
              </div>

              {/* Notice */}
              <div className="mt-8 mb-6 rounded-xl px-5 py-4" style={{ background: 'rgba(199,154,53,0.06)', border: '1px solid rgba(199,154,53,0.25)' }}>
                <p className="text-xs leading-relaxed" style={{ color: '#6B5C2E', fontFamily: 'Inter, sans-serif' }}>
                  <strong>Önemli:</strong> Rezervasyon talepleri, araç uygunluğu ve fiyat tarafımızca WhatsApp üzerinden doğrulandıktan sonra kesinleşir.
                </p>
              </div>

              {/* Submit */}
              <div className="text-center">
                <motion.button
                  type="submit"
                  className="inline-flex items-center gap-3 px-10 py-4 rounded-xl text-sm font-semibold tracking-wider uppercase transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
                  style={{
                    background:    '#C79A35',
                    color:         '#102A43',
                    fontFamily:    'Inter, sans-serif',
                    letterSpacing: '0.07em',
                    minWidth:      '280px',
                    maxWidth:      '100%',
                  }}
                  whileTap={{ scale: 0.98 }}
                  data-testid="booking-submit-button"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  {submitLabel}
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
