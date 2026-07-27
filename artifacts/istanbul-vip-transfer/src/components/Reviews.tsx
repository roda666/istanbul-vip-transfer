import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

const reviews = [
  {
    name: 'Ahmet Kaya',
    title: 'İş İnsanı, İstanbul',
    rating: 5,
    text: 'İstanbul Havalimanı\'ndan otelimize transferde mükemmel bir hizmet aldık. Sürücü kapıda isim tabelasıyla bizi karşıladı, araç tertemizdi. İş seyahatlerinde artık hep bu servisi kullanacağım. Hem saatinde hem de son derece profesyonel.',
    detail: 'İstanbul Havalimanı → Taksim',
  },
  {
    name: 'Elif Demir',
    title: 'Tur Organizatörü',
    rating: 5,
    text: 'Sabiha Gökçen\'den 11 kişilik grubumuzla uçtuk. Sprinter VIP ile karşılandık, herkesin bagajı eksiksiz yüklendi. Yolculuk boyunca su ikramı yapıldı. Gruptaki herkes çok memnun kaldı, kesinlikle tekrar tercih ederiz.',
    detail: 'Sabiha Gökçen → Sultanahmet',
  },
  {
    name: 'James Richardson',
    title: 'Turist, Londra',
    rating: 5,
    text: 'We were visiting Istanbul for the first time and the service was incredible. Our driver spoke English fluently, gave us tips about the city, and arrived 15 minutes early. The Mercedes Vito was spotless. Best transfer experience I\'ve ever had.',
    detail: 'İstanbul Havalimanı → Beşiktaş',
  },
];

export default function Reviews() {
  return (
    <section className="py-28 relative" style={{ background: '#0A0A0A' }} data-testid="reviews-section">
      <div className="gold-divider absolute top-0 left-0 right-0" />

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
          <span className="text-xs tracking-[0.3em] uppercase mb-4 block" style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
            Müşteri Yorumları
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mb-5" style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#FFFFFF' }}>
            Yolcularımız Anlatıyor
          </h2>
          <div className="mx-auto" style={{ width: '60px', height: '1px', background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />
        </motion.div>

        {/* Review Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
          {reviews.map((review, i) => (
            <motion.div
              key={review.name}
              className="relative p-8 rounded-xl overflow-hidden"
              style={{
                background: 'linear-gradient(160deg, #161616 0%, #1A1A1A 100%)',
                border: '1px solid rgba(201, 168, 76, 0.15)',
              }}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, delay: i * 0.15 }}
              data-testid={`review-card-${i}`}
            >
              {/* Top gold line */}
              <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.4), transparent)' }} />

              {/* Quote icon */}
              <div className="mb-5">
                <Quote size={28} style={{ color: 'rgba(201, 168, 76, 0.25)' }} />
              </div>

              {/* Stars */}
              <div className="flex items-center gap-1 mb-5" data-testid={`review-stars-${i}`}>
                {Array.from({ length: review.rating }).map((_, si) => (
                  <Star key={si} size={14} fill="#C9A84C" stroke="none" />
                ))}
              </div>

              {/* Review text */}
              <p className="text-sm leading-relaxed mb-6" style={{ color: '#AAA', fontFamily: 'Inter, sans-serif', fontStyle: 'italic' }}>
                "{review.text}"
              </p>

              {/* Route tag */}
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded mb-5 text-[11px] tracking-wide"
                style={{ background: 'rgba(201, 168, 76, 0.08)', border: '1px solid rgba(201, 168, 76, 0.2)', color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
              >
                {review.detail}
              </div>

              {/* Reviewer */}
              <div className="flex items-center gap-3 pt-5" style={{ borderTop: '1px solid rgba(201,168,76,0.1)' }}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #E5C36A)', color: '#0A0A0A', fontFamily: 'Inter, sans-serif' }}
                >
                  {review.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#E5E5E5', fontFamily: 'Inter, sans-serif' }}>{review.name}</p>
                  <p className="text-xs" style={{ color: '#666', fontFamily: 'Inter, sans-serif' }}>{review.title}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
