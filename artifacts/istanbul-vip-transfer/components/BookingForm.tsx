'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Clock, Users, User, Phone, Home } from 'lucide-react';
import { bookingWhatsAppUrl } from '@/lib/site-config';
import LocationCombobox from './LocationCombobox';

// ── Schema ────────────────────────────────────────────────────────────────────

const bookingSchema = z
  .object({
    alisLokasyonu: z.string().min(1, 'Lütfen kalkış noktasını seçin'),
    alisAdresi: z.string().optional(),
    varisLokasyonu: z.string().min(1, 'Lütfen varış noktasını seçin'),
    varisAdresi: z.string().optional(),
    tarih: z.string().min(1, 'Lütfen tarih seçin'),
    saatSaat: z.string().min(1, 'Lütfen saat seçin'),
    saatDakika: z
      .string()
      .min(1, 'Lütfen dakika seçin')
      .refine((v) => parseInt(v, 10) % 5 === 0, { message: 'Dakika 5\'in katı olmalıdır' }),
    yolcuSayisi: z.string().min(1, 'Lütfen yolcu sayısı seçin'),
    adSoyad: z.string().min(2, 'Lütfen adınızı ve soyadınızı girin'),
    telefon: z.string().min(10, 'Geçerli bir telefon numarası girin'),
  })
  .refine((d) => d.alisLokasyonu !== d.varisLokasyonu, {
    message: 'Kalkış ve varış aynı lokasyon olamaz',
    path: ['varisLokasyonu'],
  });

type BookingFormData = z.infer<typeof bookingSchema>;

// ── Hour/minute options ───────────────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

// ── Shared style helpers ──────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function BookingForm() {
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { yolcuSayisi: '1', saatSaat: '', saatDakika: '' },
  });

  const alisLokasyonuValue = watch('alisLokasyonu');
  const varisLokasyonuValue = watch('varisLokasyonu');

  const onSubmit = (data: BookingFormData) => {
    const saat = `${data.saatSaat}:${data.saatDakika}`;
    const lines: string[] = [
      'Merhaba, rezervasyon yapmak istiyorum.',
      '',
      `Alış Lokasyonu: ${data.alisLokasyonu}`,
    ];
    if (data.alisAdresi?.trim()) lines.push(`Alış Adresi / Otel: ${data.alisAdresi}`);
    lines.push(`Varış Lokasyonu: ${data.varisLokasyonu}`);
    if (data.varisAdresi?.trim()) lines.push(`Varış Adresi / Otel: ${data.varisAdresi}`);
    lines.push(
      `Tarih: ${data.tarih}`,
      `Saat: ${saat}`,
      `Yolcu Sayısı: ${data.yolcuSayisi}`,
      `Ad Soyad: ${data.adSoyad}`,
      `Telefon: ${data.telefon}`,
    );

    const message = encodeURIComponent(lines.join('\n'));
    window.open(bookingWhatsAppUrl(message), '_blank');
  };

  return (
    <section
      id="rezervasyon"
      className="py-24 relative"
      style={{ background: '#F7F8FC' }}
      data-testid="booking-section"
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: '#D9E2EC' }} aria-hidden="true" />
      <div className="max-w-5xl mx-auto px-5 md:px-8">
        {/* Section Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
        >
          <span
            className="text-xs tracking-[0.3em] uppercase mb-4 block"
            style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}
          >
            Hızlı Rezervasyon
          </span>
          <h2
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}
          >
            Transfer Rezervasyonu
          </h2>
          <p className="text-base max-w-lg mx-auto" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
            Formu doldurun, WhatsApp üzerinden anında onaylayalım.
          </p>
        </motion.div>

        {/* Form Card */}
        <motion.div
          className="relative rounded-2xl overflow-hidden pub-form"
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
          {/* Top gold accent strip */}
          <div
            className="h-[3px] w-full"
            style={{ background: 'linear-gradient(90deg, transparent, #C79A35 30%, #E4B84B 50%, #C79A35 70%, transparent)' }}
            aria-hidden="true"
          />

          <form onSubmit={handleSubmit(onSubmit)} className="p-8 md:p-12" data-testid="booking-form">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* ── Alış Lokasyonu ── */}
              <div data-testid="field-alis-lokasyon">
                <label style={labelStyle}>
                  <MapPin size={12} aria-hidden="true" /> Alış Lokasyonu
                </label>
                <Controller
                  control={control}
                  name="alisLokasyonu"
                  render={({ field }) => (
                    <LocationCombobox
                      for="pickup"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="Kalkış noktası seçin"
                      error={!!errors.alisLokasyonu}
                      excludeName={varisLokasyonuValue}
                    />
                  )}
                />
                {errors.alisLokasyonu && (
                  <p style={errorStyle}>{errors.alisLokasyonu.message}</p>
                )}
              </div>

              {/* ── Varış Lokasyonu ── */}
              <div data-testid="field-varis-lokasyon">
                <label style={labelStyle}>
                  <MapPin size={12} aria-hidden="true" /> Varış Lokasyonu
                </label>
                <Controller
                  control={control}
                  name="varisLokasyonu"
                  render={({ field }) => (
                    <LocationCombobox
                      for="dropoff"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="Varış noktası seçin"
                      error={!!errors.varisLokasyonu}
                      excludeName={alisLokasyonuValue}
                    />
                  )}
                />
                {errors.varisLokasyonu && (
                  <p style={errorStyle}>{errors.varisLokasyonu.message}</p>
                )}
              </div>

              {/* ── Alış Adresi ── */}
              <div data-testid="field-alis-adres">
                <label style={labelStyle}>
                  <Home size={12} aria-hidden="true" /> Alış Adresi / Otel
                  <span style={{ color: '#718596', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '11px' }}>
                    &nbsp;(opsiyonel)
                  </span>
                </label>
                <input
                  type="text"
                  {...register('alisAdresi')}
                  className="vip-input"
                  placeholder="Otel veya kesin adres"
                  data-testid="input-alis-adres"
                />
              </div>

              {/* ── Varış Adresi ── */}
              <div data-testid="field-varis-adres">
                <label style={labelStyle}>
                  <Home size={12} aria-hidden="true" /> Varış Adresi / Otel
                  <span style={{ color: '#718596', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '11px' }}>
                    &nbsp;(opsiyonel)
                  </span>
                </label>
                <input
                  type="text"
                  {...register('varisAdresi')}
                  className="vip-input"
                  placeholder="Otel veya kesin adres"
                  data-testid="input-varis-adres"
                />
              </div>

              {/* ── Tarih ── */}
              <div data-testid="field-tarih">
                <label style={labelStyle}>
                  <Calendar size={12} aria-hidden="true" /> Tarih
                </label>
                <input
                  type="date"
                  {...register('tarih')}
                  className="vip-input"
                  style={{ colorScheme: 'light' }}
                  data-testid="input-tarih"
                />
                {errors.tarih && (
                  <p style={errorStyle}>{errors.tarih.message}</p>
                )}
              </div>

              {/* ── Saat ── */}
              <div data-testid="field-saat">
                <label style={labelStyle}>
                  <Clock size={12} aria-hidden="true" /> Saat
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <select
                      {...register('saatSaat')}
                      className="vip-input vip-select"
                      style={{ width: '100%' }}
                      data-testid="input-saat-saat"
                    >
                      <option value="">Sa.</option>
                      {HOURS.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <select
                      {...register('saatDakika')}
                      className="vip-input vip-select"
                      style={{ width: '100%' }}
                      data-testid="input-saat-dakika"
                    >
                      <option value="">Dk.</option>
                      {MINUTES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {(errors.saatSaat || errors.saatDakika) && (
                  <p style={errorStyle}>
                    {errors.saatSaat?.message ?? errors.saatDakika?.message}
                  </p>
                )}
              </div>

              {/* ── Yolcu Sayısı ── */}
              <div data-testid="field-yolcu">
                <label style={labelStyle}>
                  <Users size={12} aria-hidden="true" /> Yolcu Sayısı
                </label>
                <select {...register('yolcuSayisi')} className="vip-input vip-select" data-testid="input-yolcu">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((n) => (
                    <option key={n} value={String(n)}>{n} Yolcu</option>
                  ))}
                </select>
                {errors.yolcuSayisi && (
                  <p style={errorStyle}>{errors.yolcuSayisi.message}</p>
                )}
              </div>

              {/* ── Ad Soyad ── */}
              <div data-testid="field-adsoyad">
                <label style={labelStyle}>
                  <User size={12} aria-hidden="true" /> Ad Soyad
                </label>
                <input
                  type="text"
                  {...register('adSoyad')}
                  className="vip-input"
                  placeholder="Adınız ve soyadınız"
                  data-testid="input-adsoyad"
                />
                {errors.adSoyad && (
                  <p style={errorStyle}>{errors.adSoyad.message}</p>
                )}
              </div>

              {/* ── Telefon ── */}
              <div className="md:col-span-2" data-testid="field-telefon">
                <label style={labelStyle}>
                  <Phone size={12} aria-hidden="true" /> Telefon
                </label>
                <input
                  type="tel"
                  {...register('telefon')}
                  className="vip-input"
                  placeholder="+90 5__ ___ __ __"
                  data-testid="input-telefon"
                />
                {errors.telefon && (
                  <p style={errorStyle}>{errors.telefon.message}</p>
                )}
              </div>
            </div>

            {/* Submit */}
            <div className="mt-10 text-center">
              <motion.button
                type="submit"
                className="inline-flex items-center gap-3 px-12 py-4 rounded-xl text-sm font-semibold tracking-wider uppercase transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
                style={{
                  background: '#C79A35',
                  color: '#102A43',
                  fontFamily: 'Inter, sans-serif',
                  letterSpacing: '0.1em',
                  minWidth: '300px',
                }}
                whileTap={{ scale: 0.98 }}
                data-testid="booking-submit-button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                WhatsApp ile Rezervasyon Yap
              </motion.button>
              <p className="mt-4 text-xs" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
                Mesajınız doğrudan WhatsApp&apos;a iletilir. Ek ücret yoktur.
              </p>
            </div>
          </form>
        </motion.div>
      </div>
    </section>
  );
}
