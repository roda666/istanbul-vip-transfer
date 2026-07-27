'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Clock, Users, User, Phone } from 'lucide-react';

const bookingSchema = z.object({
  nereden: z.string().min(1, 'Lütfen kalkış noktasını seçin'),
  nereye: z.string().min(1, 'Lütfen varış noktasını seçin'),
  tarih: z.string().min(1, 'Lütfen tarih seçin'),
  saat: z.string().min(1, 'Lütfen saat seçin'),
  yolcuSayisi: z.string().min(1, 'Lütfen yolcu sayısı seçin'),
  adSoyad: z.string().min(2, 'Lütfen adınızı ve soyadınızı girin'),
  telefon: z.string().min(10, 'Geçerli bir telefon numarası girin'),
});

type BookingFormData = z.infer<typeof bookingSchema>;

const locations = [
  'İstanbul Havalimanı (IST)',
  'Sabiha Gökçen Havalimanı (SAW)',
  'Otel / Adres',
  'Taksim Meydanı',
  'Sultanahmet',
  'Beşiktaş',
  'Kadıköy',
  'Üsküdar',
];

export default function BookingForm() {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { yolcuSayisi: '1' },
  });

  const neredenValue = watch('nereden');

  const onSubmit = (data: BookingFormData) => {
    const message = encodeURIComponent(
      `Merhaba, rezervasyon yapmak istiyorum.\n\n` +
        `Nereden: ${data.nereden}\n` +
        `Nereye: ${data.nereye}\n` +
        `Tarih: ${data.tarih}\n` +
        `Saat: ${data.saat}\n` +
        `Yolcu Sayisi: ${data.yolcuSayisi}\n` +
        `Ad Soyad: ${data.adSoyad}\n` +
        `Telefon: ${data.telefon}`,
    );
    window.open(`https://wa.me/905326600847?text=${message}`, '_blank');
  };

  return (
    <section
      id="rezervasyon"
      className="py-24 relative"
      style={{ background: 'linear-gradient(180deg, #0A0A0A 0%, #111111 50%, #0A0A0A 100%)' }}
      data-testid="booking-section"
    >
      <div className="gold-divider mb-0" />
      <div className="max-w-5xl mx-auto px-5 md:px-8">
        {/* Section Header */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
        >
          <span className="text-xs tracking-[0.3em] uppercase mb-4 block" style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
            Hızlı Rezervasyon
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#FFFFFF' }}>
            Transfer Rezervasyonu
          </h2>
          <p className="text-base max-w-lg mx-auto" style={{ color: '#888', fontFamily: 'Inter, sans-serif' }}>
            Formu doldurun, WhatsApp üzerinden anında onaylayalım.
          </p>
        </motion.div>

        {/* Form Card */}
        <motion.div
          className="relative rounded-xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #161616 0%, #1A1A1A 100%)',
            border: '1px solid rgba(201,168,76,0.2)',
            boxShadow: '0 40px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(201,168,76,0.1)',
          }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, delay: 0.2 }}
          data-testid="booking-form-card"
        >
          <div className="h-[2px] w-full" style={{ background: 'linear-gradient(90deg, transparent, #C9A84C 30%, #E5C36A 50%, #C9A84C 70%, transparent)' }} />

          <form onSubmit={handleSubmit(onSubmit)} className="p-8 md:p-12" data-testid="booking-form">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nereden */}
              <div data-testid="field-nereden">
                <label className="flex items-center gap-2 text-xs tracking-widest uppercase mb-2.5" style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
                  <MapPin size={12} /> Nereden
                </label>
                <select {...register('nereden')} className="vip-input vip-select" data-testid="input-nereden">
                  <option value="">Kalkış noktası seçin</option>
                  {locations.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
                </select>
                {errors.nereden && <p className="mt-1.5 text-xs" style={{ color: '#E07070', fontFamily: 'Inter, sans-serif' }}>{errors.nereden.message}</p>}
              </div>

              {/* Nereye */}
              <div data-testid="field-nereye">
                <label className="flex items-center gap-2 text-xs tracking-widest uppercase mb-2.5" style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
                  <MapPin size={12} /> Nereye
                </label>
                <select {...register('nereye')} className="vip-input vip-select" data-testid="input-nereye">
                  <option value="">Varış noktası seçin</option>
                  {locations.filter((l) => l !== neredenValue).map((loc) => <option key={loc} value={loc}>{loc}</option>)}
                </select>
                {errors.nereye && <p className="mt-1.5 text-xs" style={{ color: '#E07070', fontFamily: 'Inter, sans-serif' }}>{errors.nereye.message}</p>}
              </div>

              {/* Tarih */}
              <div data-testid="field-tarih">
                <label className="flex items-center gap-2 text-xs tracking-widest uppercase mb-2.5" style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
                  <Calendar size={12} /> Tarih
                </label>
                <input type="date" {...register('tarih')} className="vip-input" style={{ colorScheme: 'dark' }} data-testid="input-tarih" />
                {errors.tarih && <p className="mt-1.5 text-xs" style={{ color: '#E07070', fontFamily: 'Inter, sans-serif' }}>{errors.tarih.message}</p>}
              </div>

              {/* Saat */}
              <div data-testid="field-saat">
                <label className="flex items-center gap-2 text-xs tracking-widest uppercase mb-2.5" style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
                  <Clock size={12} /> Saat
                </label>
                <input type="time" {...register('saat')} className="vip-input" style={{ colorScheme: 'dark' }} data-testid="input-saat" />
                {errors.saat && <p className="mt-1.5 text-xs" style={{ color: '#E07070', fontFamily: 'Inter, sans-serif' }}>{errors.saat.message}</p>}
              </div>

              {/* Yolcu Sayısı */}
              <div data-testid="field-yolcu">
                <label className="flex items-center gap-2 text-xs tracking-widest uppercase mb-2.5" style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
                  <Users size={12} /> Yolcu Sayısı
                </label>
                <select {...register('yolcuSayisi')} className="vip-input vip-select" data-testid="input-yolcu">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((n) => (
                    <option key={n} value={String(n)}>{n} Yolcu</option>
                  ))}
                </select>
                {errors.yolcuSayisi && <p className="mt-1.5 text-xs" style={{ color: '#E07070', fontFamily: 'Inter, sans-serif' }}>{errors.yolcuSayisi.message}</p>}
              </div>

              {/* Ad Soyad */}
              <div data-testid="field-adsoyad">
                <label className="flex items-center gap-2 text-xs tracking-widest uppercase mb-2.5" style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
                  <User size={12} /> Ad Soyad
                </label>
                <input type="text" {...register('adSoyad')} className="vip-input" placeholder="Adınız ve soyadınız" data-testid="input-adsoyad" />
                {errors.adSoyad && <p className="mt-1.5 text-xs" style={{ color: '#E07070', fontFamily: 'Inter, sans-serif' }}>{errors.adSoyad.message}</p>}
              </div>

              {/* Telefon */}
              <div className="md:col-span-2" data-testid="field-telefon">
                <label className="flex items-center gap-2 text-xs tracking-widest uppercase mb-2.5" style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
                  <Phone size={12} /> Telefon
                </label>
                <input type="tel" {...register('telefon')} className="vip-input" placeholder="+90 5__ ___ __ __" data-testid="input-telefon" />
                {errors.telefon && <p className="mt-1.5 text-xs" style={{ color: '#E07070', fontFamily: 'Inter, sans-serif' }}>{errors.telefon.message}</p>}
              </div>
            </div>

            {/* Submit */}
            <div className="mt-10 text-center">
              <motion.button
                type="submit"
                className="inline-flex items-center gap-3 px-12 py-5 rounded text-sm font-semibold tracking-widest uppercase transition-all duration-300 hover:shadow-2xl hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(135deg, #C9A84C, #E5C36A)',
                  color: '#0A0A0A',
                  fontFamily: 'Inter, sans-serif',
                  letterSpacing: '0.12em',
                  minWidth: '320px',
                }}
                whileTap={{ scale: 0.98 }}
                data-testid="booking-submit-button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                WhatsApp ile Rezervasyon Yap
              </motion.button>
              <p className="mt-4 text-xs" style={{ color: '#555', fontFamily: 'Inter, sans-serif' }}>
                Mesajınız doğrudan WhatsApp&apos;a iletilir. Ek ücret yoktur.
              </p>
            </div>
          </form>
        </motion.div>
      </div>
    </section>
  );
}
