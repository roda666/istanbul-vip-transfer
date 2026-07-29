'use client';

import { motion } from 'framer-motion';
import { Star, Quote, ExternalLink } from 'lucide-react';
import { SITE } from '@/lib/site-config';
import { useLang } from '@/lib/i18n/context';

interface Review {
  name: string;
  rating: number;
  text: string;
}

const REVIEWS_BY_LANG: Record<string, Review[]> = {
  tr: [
    {
      name: 'Ahmet Kaya',
      rating: 5,
      text: "İstanbul Havalimanı'ndan otelimize transferde mükemmel bir hizmet aldık. Sürücü kapıda isim tabelasıyla bizi karşıladı, araç tertemizdi. İş seyahatlerinde artık hep bu servisi kullanacağım. Hem saatinde hem de son derece profesyonel.",
    },
    {
      name: 'Elif Demir',
      rating: 5,
      text: "Sabiha Gökçen'den 11 kişilik grubumuzla uçtuk. Sprinter VIP ile karşılandık, herkesin bagajı eksiksiz yüklendi. Yolculuk boyunca su ikramı yapıldı. Gruptaki herkes çok memnun kaldı, kesinlikle tekrar tercih ederiz.",
    },
    {
      name: 'James Richardson',
      rating: 5,
      text: "We were visiting Istanbul for the first time and the service was incredible. Our driver spoke English fluently, gave us tips about the city, and arrived 15 minutes early. The Mercedes Vito was spotless. Best transfer experience I've ever had.",
    },
  ],
  en: [
    {
      name: 'James Richardson',
      rating: 5,
      text: "We were visiting Istanbul for the first time and the service was incredible. Our driver spoke English fluently, gave us tips about the city, and arrived 15 minutes early. The Mercedes Vito was spotless. Best transfer experience I've ever had.",
    },
    {
      name: 'Sarah Mitchell',
      rating: 5,
      text: "Booked a Sprinter for our group of 10 from Istanbul Airport. The vehicle was pristine, driver was punctual and professional, and the meet-and-greet with the name board made everything stress-free. Highly recommend for business travel.",
    },
    {
      name: 'Mark Thompson',
      rating: 5,
      text: "Used this service for three back-to-back business trips. Every time the driver was early, vehicle was spotless, and the ride was smooth. Booking via WhatsApp is quick and easy. Won't use anyone else in Istanbul.",
    },
  ],
  de: [
    {
      name: 'Klaus Müller',
      rating: 5,
      text: "Hervorragender Transfer vom Flughafen Istanbul. Der Fahrer wartete mit einem Namensschild, half mit dem Gepäck und brachte uns pünktlich ins Hotel. Der Mercedes Sprinter war geräumig und sehr sauber. Absolut empfehlenswert!",
    },
    {
      name: 'Petra Schneider',
      rating: 5,
      text: "Wir haben den VIP-Transfer für unsere Familienreise gebucht. Trotz unserer Flugverspätung war der Fahrer noch da und sehr entspannt. Tolles Fahrzeug, professioneller Service — wir buchen beim nächsten Istanbul-Besuch wieder.",
    },
    {
      name: 'James Richardson',
      rating: 5,
      text: "Wir besuchten Istanbul zum ersten Mal und der Service war unglaublich. Unser Fahrer sprach fließend Englisch, gab Tipps zur Stadt und war 15 Minuten früher. Der Mercedes Vito war makellos. Beste Transfererfahrung, die ich je gemacht habe.",
    },
  ],
  ru: [
    {
      name: 'Александр Иванов',
      rating: 5,
      text: "Отличный трансфер из аэропорта Стамбула. Водитель встретил нас с табличкой, помог с багажом и довёз до отеля вовремя. Mercedes Sprinter был просторным и чистым. Всем рекомендую!",
    },
    {
      name: 'Наталья Петрова',
      rating: 5,
      text: "Бронировали VIP-трансфер для семейной поездки. Несмотря на задержку рейса, водитель терпеливо ждал. Отличное авто, профессиональный сервис — закажем снова при следующем визите в Стамбул.",
    },
    {
      name: 'James Richardson',
      rating: 5,
      text: "Мы приехали в Стамбул впервые, и сервис был превосходным. Водитель свободно говорил по-английски, давал советы по городу и приехал на 15 минут раньше. Mercedes Vito был безупречен. Лучший трансфер, который я когда-либо пробовал.",
    },
  ],
  ar: [
    {
      name: 'محمد العلي',
      rating: 5,
      text: "خدمة رائعة من مطار إسطنبول. السائق كان في انتظارنا مع لافتة بالاسم، وساعد في حمل الأمتعة، ووصلنا إلى الفندق في الوقت المحدد. مرسيدس سبرينتر كانت فسيحة ونظيفة للغاية. أوصي بها بشدة!",
    },
    {
      name: 'فاطمة الزهراء',
      rating: 5,
      text: "حجزنا نقل VIP لرحلتنا العائلية. على الرغم من تأخر الرحلة، انتظر السائق بصبر. سيارة رائعة وخدمة احترافية — سنحجز مجدداً في زيارتنا القادمة لإسطنبول.",
    },
    {
      name: 'James Richardson',
      rating: 5,
      text: "كانت زيارتنا الأولى لإسطنبول والخدمة كانت رائعة. السائق تحدث الإنجليزية بطلاقة وأعطانا نصائح عن المدينة ووصل قبل الموعد بـ 15 دقيقة. كانت مرسيدس فيتو نظيفة تماماً. أفضل تجربة نقل على الإطلاق.",
    },
  ],
};

function GoogleMark({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-label="Google" role="img">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function Reviews() {
  const { lang, dict } = useLang();
  const r = dict.reviews;
  const reviews = REVIEWS_BY_LANG[lang] ?? REVIEWS_BY_LANG.tr;

  return (
    <section
      className="py-24 relative"
      style={{ background: '#EAF2F8' }}
      data-testid="reviews-section"
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: '#D9E2EC' }} aria-hidden="true" />
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        {/* Section Header */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          data-testid="reviews-header"
        >
          <div
            className="inline-flex items-center gap-2 mb-5 px-4 py-2 rounded-full"
            style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid #D9E2EC', boxShadow: '0 1px 4px rgba(16,42,67,0.06)' }}
          >
            <GoogleMark size={16} />
            <span
              className="text-xs tracking-[0.2em] uppercase"
              style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
            >
              {r.sectionLabel}
            </span>
          </div>
          <h2
            className="text-4xl md:text-5xl font-bold mb-5"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}
          >
            {r.heading}
          </h2>
          <div
            className="mx-auto"
            style={{ width: '60px', height: '3px', background: 'linear-gradient(90deg, #C79A35, #E4B84B)', borderRadius: '2px' }}
          />
        </motion.div>

        {/* Review Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {reviews.map((review, i) => (
            <motion.div
              key={review.name}
              className="relative p-7 rounded-2xl overflow-hidden flex flex-col"
              style={{
                background: '#FFFFFF',
                border: '1px solid #D9E2EC',
                boxShadow: '0 2px 16px rgba(16,42,67,0.06)',
              }}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, delay: i * 0.15 }}
              data-testid={`review-card-${i}`}
            >
              <div
                className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(199,154,53,0.5), transparent)' }}
                aria-hidden="true"
              />
              <div className="mb-4">
                <Quote size={26} style={{ color: 'rgba(199,154,53,0.3)' }} aria-hidden="true" />
              </div>
              <div
                className="flex items-center gap-1 mb-4"
                aria-label={`${review.rating} stars`}
                data-testid={`review-stars-${i}`}
              >
                {Array.from({ length: review.rating }).map((_, si) => (
                  <Star key={si} size={14} fill="#C79A35" stroke="none" aria-hidden="true" />
                ))}
              </div>
              <p
                className="text-sm leading-relaxed flex-1 mb-5"
                style={{ color: '#263F55', fontFamily: 'Inter, sans-serif', fontStyle: 'italic' }}
              >
                &ldquo;{review.text}&rdquo;
              </p>
              <div
                className="flex items-center justify-between pt-4"
                style={{ borderTop: '1px solid #D9E2EC' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: '#C79A35', color: '#102A43', fontFamily: 'Inter, sans-serif' }}
                  >
                    {review.name.charAt(0)}
                  </div>
                  <p className="text-sm font-semibold" style={{ color: '#102A43', fontFamily: 'Inter, sans-serif' }}>
                    {review.name}
                  </p>
                </div>
                <div><GoogleMark size={18} /></div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <a
            href={SITE.googleBusinessUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-10 py-4 rounded-xl text-sm font-semibold transition-all duration-300 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C79A35] focus-visible:ring-offset-2"
            style={{
              background: '#C79A35',
              color: '#102A43',
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.04em',
            }}
            data-testid="google-reviews-button"
          >
            {r.viewAll}
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
