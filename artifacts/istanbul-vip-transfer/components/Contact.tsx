'use client';

import { motion } from 'framer-motion';
import { Phone, Clock, MapPin, Mail } from 'lucide-react';
import { SITE } from '@/lib/site-config';

export default function Contact() {
  return (
    <section
      id="iletisim"
      className="py-24 relative"
      style={{ background: '#EAF2F8' }}
      data-testid="contact-section"
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: '#D9E2EC' }} aria-hidden="true" />

      <div className="max-w-4xl mx-auto px-5 md:px-8">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          data-testid="contact-header"
        >
          <span
            className="text-xs tracking-[0.3em] uppercase mb-4 block"
            style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}
          >
            İletişim
          </span>
          <h2
            className="text-4xl md:text-5xl font-bold mb-5"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}
          >
            Her An Yanınızdayız
          </h2>
          <div
            className="mx-auto mb-5"
            style={{ width: '60px', height: '3px', background: 'linear-gradient(90deg, #C79A35, #E4B84B)', borderRadius: '2px' }}
          />
          <p className="text-base max-w-lg mx-auto" style={{ color: '#627D98', fontFamily: 'Inter, sans-serif' }}>
            Sorularınız için 7/24 ulaşabilirsiniz. WhatsApp ile hızlı destek alın.
          </p>
        </motion.div>

        {/* Main CTA Card */}
        <motion.div
          className="relative rounded-2xl overflow-hidden mb-8 text-center p-10 md:p-14"
          style={{
            background: '#FFFFFF',
            border: '1px solid #D9E2EC',
            boxShadow: '0 8px 40px rgba(16,42,67,0.08)',
          }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8 }}
          data-testid="contact-cta-card"
        >
          {/* Top gold strip */}
          <div
            className="absolute top-0 left-0 right-0 h-[3px]"
            style={{ background: 'linear-gradient(90deg, transparent, #C79A35 30%, #E4B84B 50%, #C79A35 70%, transparent)' }}
            aria-hidden="true"
          />
          <p
            className="text-xs tracking-widest uppercase mb-3"
            style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}
          >
            7/24 Destek Hattı
          </p>
          <a
            href={SITE.phoneTel}
            className="text-4xl md:text-5xl font-bold mb-8 block transition-colors duration-300 focus:outline-none focus-visible:underline"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#C79A35'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#102A43'; }}
          >
            {SITE.phoneDisplay}
          </a>
          <motion.a
            href={SITE.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-10 py-4 rounded-xl text-base font-semibold transition-all duration-300 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A36A] focus-visible:ring-offset-2"
            style={{ background: '#16A36A', color: '#FFFFFF', fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em' }}
            whileTap={{ scale: 0.97 }}
            data-testid="contact-whatsapp-button"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            WhatsApp ile Mesaj Gönder
          </motion.a>
        </motion.div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Phone,  title: 'Telefon',          content: SITE.phoneDisplay,  sub: 'Her saat ulaşabilirsiniz', href: SITE.phoneTel },
            { icon: Clock,  title: 'Çalışma Saatleri', content: '7/24 Açık',         sub: 'Yılın 365 günü',           href: null },
            { icon: Mail,   title: 'E-posta',           content: SITE.email,          sub: 'İletişim için yazın',      href: SITE.emailMailto },
            { icon: MapPin, title: 'Hizmet Bölgesi',   content: 'Tüm İstanbul',       sub: 'Her semte transfer',       href: null },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              className="p-5 rounded-xl text-center"
              style={{
                background: '#FFFFFF',
                border: '1px solid #D9E2EC',
                boxShadow: '0 1px 6px rgba(16,42,67,0.05)',
              }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              data-testid={`contact-info-${i}`}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(199,154,53,0.1)', border: '1px solid rgba(199,154,53,0.2)' }}
              >
                <item.icon size={18} style={{ color: '#C79A35' }} aria-hidden="true" />
              </div>
              <p
                className="text-xs tracking-widest uppercase mb-1.5"
                style={{ color: '#627D98', fontFamily: 'Inter, sans-serif' }}
              >
                {item.title}
              </p>
              {item.href ? (
                <a
                  href={item.href}
                  {...(item.href.startsWith('mailto:') || item.href.startsWith('tel:') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                  className="text-sm font-semibold mb-1 block transition-colors duration-300 break-all focus:outline-none focus-visible:underline"
                  style={{ color: '#102A43', fontFamily: 'Inter, sans-serif' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#C79A35'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#102A43'; }}
                >
                  {item.content}
                </a>
              ) : (
                <p className="text-sm font-semibold mb-1" style={{ color: '#102A43', fontFamily: 'Inter, sans-serif' }}>
                  {item.content}
                </p>
              )}
              <p className="text-xs" style={{ color: '#627D98', fontFamily: 'Inter, sans-serif' }}>
                {item.sub}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
