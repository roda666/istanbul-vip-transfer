import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

const faqs = [
  {
    question: 'Transfer ücretleriniz nasıl belirleniyor?',
    answer: 'Fiyatlar mesafeye, araç tipine ve güzergaha göre belirlenir. Fiyat bilgisi almak için WhatsApp üzerinden bizimle iletişime geçin; rezervasyon öncesinde size bilgi verilir.',
  },
  {
    question: 'Kaç bagaj taşıyabilirim?',
    answer: 'Mercedes Vito ile 7 yolcu ve 7 büyük bagaj, Mercedes Sprinter VIP ile ise 13 yolcu ve 13 büyük bagaj kapasitesi sunuyoruz. Fazla bagajınız varsa lütfen rezervasyon sırasında bilgi verin, en uygun aracı birlikte belirleyelim.',
  },
  {
    question: 'Uçuşum gecikirse sürücü bekler mi?',
    answer: 'Uçuşunuzu takip ediyoruz. Gecikme durumunda sürücünüz bilgilendirilir. Bekleme koşulları ve detaylar için rezervasyon sırasında WhatsApp üzerinden bilgi alabilirsiniz.',
  },
  {
    question: 'Hangi ödeme yöntemlerini kabul ediyorsunuz?',
    answer: 'Ödeme yöntemleri hakkında bilgi almak için WhatsApp üzerinden bizimle iletişime geçin; rezervasyon öncesinde size detay verilir.',
  },
  {
    question: 'Ne kadar önceden rezervasyon yapmalıyım?',
    answer: 'En az 2 saat öncesinden rezervasyon yapmanızı öneririz. Ancak müsaitlik durumuna göre çok daha kısa sürelerde de transferinizi organize edebiliriz. Yoğun sezonlarda (yaz ayları, bayramlar) önceden rezervasyon yapmanız kesinlikle tavsiye edilir.',
  },
  {
    question: 'Çocuk koltuğu talep edebilir miyim?',
    answer: 'Evet, rezervasyon sırasında çocuğunuzun yaşını ve ağırlığını belirtmeniz yeterlidir. Uygun çocuk koltuğunu ücretsiz olarak hazırlıyoruz. Bebek koltuğu, öne bakan koltuk veya yükseltici koltuk talep edebilirsiniz.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-28 relative" style={{ background: '#111111' }} data-testid="faq-section">
      <div className="gold-divider absolute top-0 left-0 right-0" />

      <div className="max-w-3xl mx-auto px-5 md:px-8">
        {/* Section Header */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          data-testid="faq-header"
        >
          <span className="text-xs tracking-[0.3em] uppercase mb-4 block" style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
            Sık Sorulan Sorular
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mb-5" style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#FFFFFF' }}>
            Merak Ettikleriniz
          </h2>
          <div className="mx-auto" style={{ width: '60px', height: '1px', background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />
        </motion.div>

        {/* FAQ Items */}
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              className="rounded-xl overflow-hidden"
              style={{
                background: 'linear-gradient(160deg, #161616 0%, #1A1A1A 100%)',
                border: openIndex === i ? '1px solid rgba(201, 168, 76, 0.35)' : '1px solid rgba(201, 168, 76, 0.1)',
                transition: 'border-color 0.3s ease',
              }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              data-testid={`faq-item-${i}`}
            >
              <button
                className="w-full flex items-center justify-between p-6 text-left group"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                data-testid={`faq-toggle-${i}`}
              >
                <span
                  className="text-base font-medium pr-4 transition-colors duration-300 group-hover:text-[#C9A84C]"
                  style={{ fontFamily: 'Inter, sans-serif', color: openIndex === i ? '#E5C36A' : '#E5E5E5' }}
                >
                  {faq.question}
                </span>
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300"
                  style={{
                    background: openIndex === i ? 'linear-gradient(135deg, #C9A84C, #E5C36A)' : 'rgba(201, 168, 76, 0.1)',
                    border: openIndex === i ? 'none' : '1px solid rgba(201, 168, 76, 0.25)',
                  }}
                >
                  {openIndex === i
                    ? <Minus size={14} style={{ color: '#0A0A0A' }} />
                    : <Plus size={14} style={{ color: '#C9A84C' }} />
                  }
                </div>
              </button>

              <AnimatePresence initial={false}>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.04, 0.62, 0.23, 0.98] }}
                    data-testid={`faq-answer-${i}`}
                  >
                    <div className="px-6 pb-6">
                      <div
                        className="h-px mb-4"
                        style={{ background: 'linear-gradient(90deg, rgba(201,168,76,0.2), transparent)' }}
                      />
                      <p className="text-sm leading-relaxed" style={{ color: '#888', fontFamily: 'Inter, sans-serif' }}>
                        {faq.answer}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
