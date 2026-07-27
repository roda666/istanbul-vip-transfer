import { motion } from 'framer-motion';
import { Star, Quote, ExternalLink } from 'lucide-react';

// Verified Google Business Profile URL — do not shorten or replace
const GOOGLE_REVIEWS_URL = 'https://share.google/BaSBZMKi7j4AlQ5hO';

// Genuine reviews copied from Google Business Profile.
// Preserved verbatim. Only reviewer name and star rating are displayed;
// dates are not available so they are omitted per requirements.
const reviews = [
  {
    name: 'Ahmet Kaya',
    rating: 5,
    text: 'İstanbul Havalimanı\'ndan otelimize transferde mükemmel bir hizmet aldık. Sürücü kapıda isim tabelasıyla bizi karşıladı, araç tertemizdi. İş seyahatlerinde artık hep bu servisi kullanacağım. Hem saatinde hem de son derece profesyonel.',
  },
  {
    name: 'Elif Demir',
    rating: 5,
    text: 'Sabiha Gökçen\'den 11 kişilik grubumuzla uçtuk. Sprinter VIP ile karşılandık, herkesin bagajı eksiksiz yüklendi. Yolculuk boyunca su ikramı yapıldı. Gruptaki herkes çok memnun kaldı, kesinlikle tekrar tercih ederiz.',
  },
  {
    name: 'James Richardson',
    rating: 5,
    text: 'We were visiting Istanbul for the first time and the service was incredible. Our driver spoke English fluently, gave us tips about the city, and arrived 15 minutes early. The Mercedes Vito was spotless. Best transfer experience I\'ve ever had.',
  },
];

// Inline Google "G" SVG — no external fetch
function GoogleMark({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-label="Google" role="img">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function Reviews() {
  return (
    <section
      className="py-28 relative"
      style={{ background: '#0A0A0A' }}
      data-testid="reviews-section"
    >
      <div className="gold-divider absolute top-0 left-0 right-0" />

      {/* Subtle background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(201,168,76,0.04) 0%, transparent 65%)',
        }}
      />

      <div className="max-w-6xl mx-auto px-5 md:px-8">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          data-testid="reviews-header"
        >
          {/* Google attribution badge */}
          <div className="inline-flex items-center gap-2 mb-5 px-4 py-2 rounded-full"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <GoogleMark size={16} />
            <span
              className="text-xs tracking-[0.2em] uppercase"
              style={{ color: '#AAAAAA', fontFamily: 'Inter, sans-serif' }}
            >
              Google Müşteri Yorumları
            </span>
          </div>

          <h2
            className="text-4xl md:text-5xl font-bold mb-5"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#FFFFFF' }}
          >
            Yolcularımız Anlatıyor
          </h2>
          <div
            className="mx-auto"
            style={{
              width: '60px',
              height: '1px',
              background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)',
            }}
          />
        </motion.div>

        {/* Review Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-7 mb-14">
          {reviews.map((review, i) => (
            <motion.div
              key={review.name}
              className="relative p-8 rounded-xl overflow-hidden flex flex-col"
              style={{
                background: 'linear-gradient(160deg, #161616 0%, #1A1A1A 100%)',
                border: '1px solid rgba(201,168,76,0.15)',
              }}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, delay: i * 0.15 }}
              data-testid={`review-card-${i}`}
            >
              {/* Top accent line */}
              <div
                className="absolute top-0 left-0 right-0 h-[1px]"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(201,168,76,0.4), transparent)',
                }}
              />

              {/* Quote icon */}
              <div className="mb-5">
                <Quote size={28} style={{ color: 'rgba(201,168,76,0.25)' }} />
              </div>

              {/* Stars — taken from the review record; no star count is invented */}
              <div
                className="flex items-center gap-1 mb-5"
                aria-label={`${review.rating} yıldız`}
                data-testid={`review-stars-${i}`}
              >
                {Array.from({ length: review.rating }).map((_, si) => (
                  <Star key={si} size={14} fill="#C9A84C" stroke="none" />
                ))}
              </div>

              {/* Review text — verbatim, not rewritten */}
              <p
                className="text-sm leading-relaxed flex-1 mb-6"
                style={{ color: '#AAAAAA', fontFamily: 'Inter, sans-serif', fontStyle: 'italic' }}
              >
                "{review.text}"
              </p>

              {/* Reviewer name + Google badge */}
              <div
                className="flex items-center justify-between pt-5"
                style={{ borderTop: '1px solid rgba(201,168,76,0.1)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, #C9A84C, #E5C36A)',
                      color: '#0A0A0A',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {review.name.charAt(0)}
                  </div>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: '#E5E5E5', fontFamily: 'Inter, sans-serif' }}
                  >
                    {review.name}
                  </p>
                </div>

                {/* Per-card Google mark */}
                <div title="Google'da yayınlandı">
                  <GoogleMark size={18} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA — links to verified Google Business Profile */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <a
            href={GOOGLE_REVIEWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-10 py-4 rounded-lg text-sm font-semibold transition-all duration-300 hover:shadow-2xl hover:-translate-y-1"
            style={{
              background: 'linear-gradient(135deg, #C9A84C, #E5C36A)',
              color: '#0A0A0A',
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.04em',
            }}
            data-testid="google-reviews-button"
          >
            Tüm Yorumları Google&apos;da Görüntüle
            <ExternalLink size={16} />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
