'use client';

import { motion } from 'framer-motion';
import { Phone, Clock, MapPin, Mail } from 'lucide-react';

export default function Contact() {
  return (
    <section id="iletisim" className="py-28 relative" style={{ background: '#0A0A0A' }} data-testid="contact-section">
      <div className="gold-divider absolute top-0 left-0 right-0" />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.05) 0%, transparent 65%)' }} />

      <div className="max-w-4xl mx-auto px-5 md:px-8">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          data-testid="contact-header"
        >
          <span className="text-xs tracking-[0.3em] uppercase mb-4 block" style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
            İletişim
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mb-5" style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#FFFFFF' }}>
            Her An Yanınızdayız
          </h2>
          <div className="mx-auto mb-5" style={{ width: '60px', height: '1px', background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />
          <p className="text-base max-w-lg mx-auto" style={{ color: '#888', fontFamily: 'Inter, sans-serif' }}>
            Sorularınız için 7/24 ulaşabilirsiniz. WhatsApp ile hızlı destek alın.
          </p>
        </motion.div>

        {/* Main CTA Card */}
        <motion.div
          className="relative rounded-2xl overflow-hidden mb-10 text-center p-12 md:p-16"
          style={{
            background: 'linear-gradient(135deg, #161616 0%, #1A1A1A 100%)',
            border: '1px solid rgba(201,168,76,0.25)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
          }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8 }}
          data-testid="contact-cta-card"
        >
          <div className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: 'linear-gradient(90deg, transparent, #C9A84C 30%, #E5C36A 50%, #C9A84C 70%, transparent)' }} />
          <p className="text-sm tracking-widest uppercase mb-3" style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
            7/24 Destek Hattı
          </p>
          <a
            href="tel:+905326600847"
            className="text-5xl md:text-6xl font-bold mb-8 block transition-colors duration-300 hover:text-[#C9A84C]"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#FFFFFF' }}
          >
            +90 532 660 08 47
          </a>
          <motion.a
            href="https://wa.me/905326600847"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-12 py-5 rounded-lg text-base font-semibold transition-all duration-300 hover:shadow-2xl hover:-translate-y-1"
            style={{ background: '#25D366', color: '#FFFFFF', fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em' }}
            whileTap={{ scale: 0.97 }}
            data-testid="contact-whatsapp-button"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            WhatsApp ile Mesaj Gönder
          </motion.a>
        </motion.div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            { icon: Phone, title: 'Telefon', content: '+90 532 660 08 47', sub: 'Her saat ulaşabilirsiniz', href: 'tel:+905326600847' },
            { icon: Clock, title: 'Çalışma Saatleri', content: '7/24 Açık', sub: 'Yılın 365 günü', href: null },
            { icon: Mail, title: 'E-posta', content: 'info@istanbulviptransfer.com', sub: 'İletişim için yazın', href: 'mailto:info@istanbulviptransfer.com' },
            { icon: MapPin, title: 'Hizmet Bölgesi', content: 'Tüm İstanbul', sub: 'Her semte transfer', href: null },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              className="p-6 rounded-xl text-center"
              style={{ background: 'linear-gradient(160deg, #161616 0%, #1A1A1A 100%)', border: '1px solid rgba(201,168,76,0.12)' }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              data-testid={`contact-info-${i}`}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)' }}>
                <item.icon size={18} style={{ color: '#C9A84C' }} />
              </div>
              <p className="text-xs tracking-widest uppercase mb-1.5" style={{ color: '#666', fontFamily: 'Inter, sans-serif' }}>{item.title}</p>
              {item.href ? (
                <a href={item.href} className="text-sm font-semibold mb-1 block transition-colors duration-300 hover:text-[#C9A84C]"
                  style={{ color: '#E5E5E5', fontFamily: 'Inter, sans-serif' }}>{item.content}</a>
              ) : (
                <p className="text-sm font-semibold mb-1" style={{ color: '#E5E5E5', fontFamily: 'Inter, sans-serif' }}>{item.content}</p>
              )}
              <p className="text-xs" style={{ color: '#555', fontFamily: 'Inter, sans-serif' }}>{item.sub}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
