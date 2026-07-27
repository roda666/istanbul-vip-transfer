import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';

const GOOGLE_REVIEWS_URL = 'https://share.google/BaSBZMKi7j4AlQ5hO';

export default function Reviews() {
  return (
    <section
      className="py-28 relative"
      style={{ background: '#0A0A0A' }}
      data-testid="reviews-section"
    >
      <div className="gold-divider absolute top-0 left-0 right-0" />

      {/* Subtle radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(201, 168, 76, 0.04) 0%, transparent 65%)',
        }}
      />

      <div className="max-w-3xl mx-auto px-5 md:px-8">
        {/* Section Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          data-testid="reviews-header"
        >
          <span
            className="text-xs tracking-[0.3em] uppercase mb-4 block"
            style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
          >
            Google Müşteri Yorumları
          </span>
          <h2
            className="text-4xl md:text-5xl font-bold mb-5"
            style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              color: '#FFFFFF',
            }}
          >
            Müşterilerimiz Ne Diyor?
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

        {/* CTA Card */}
        <motion.div
          className="relative rounded-2xl overflow-hidden text-center p-12 md:p-16"
          style={{
            background: 'linear-gradient(135deg, #161616 0%, #1A1A1A 100%)',
            border: '1px solid rgba(201, 168, 76, 0.2)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
          }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, delay: 0.1 }}
          data-testid="reviews-cta-card"
        >
          {/* Gold top accent */}
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{
              background:
                'linear-gradient(90deg, transparent, #C9A84C 30%, #E5C36A 50%, #C9A84C 70%, transparent)',
            }}
          />

          {/* Google "G" logo mark — SVG, no external fetch */}
          <div className="flex justify-center mb-8" data-testid="google-logo">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: '#FFFFFF',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}
            >
              {/* Official Google "G" colours */}
              <svg
                viewBox="0 0 24 24"
                width="32"
                height="32"
                aria-label="Google"
                role="img"
              >
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
            </div>
          </div>

          <p
            className="text-base md:text-lg mb-2 font-medium"
            style={{
              color: '#E5E5E5',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Tüm gerçek müşteri yorumlarımızı Google&apos;da okuyun.
          </p>
          <p
            className="text-sm mb-10"
            style={{ color: '#666', fontFamily: 'Inter, sans-serif' }}
          >
            Yorumlar doğrudan Google İşletme Profili üzerinden yayınlanmaktadır.
          </p>

          {/* CTA Button */}
          <motion.a
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
            whileTap={{ scale: 0.97 }}
            data-testid="google-reviews-button"
          >
            Tüm Yorumları Google&apos;da Görüntüle
            <ExternalLink size={16} />
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
