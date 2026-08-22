'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import { getFaqs } from '@/lib/faq-data';
import { useLang } from '@/lib/i18n/context';
import type { HomepageFaq } from '@/lib/homepage-public-content';

export default function FAQ({ items }: { items?: HomepageFaq[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { lang, dict } = useLang();
  const faqs = items && items.length > 0 ? items : getFaqs(lang);

  return (
    <section
      className="py-24 relative"
      style={{ background: '#FFFDF8' }}
      data-testid="faq-section"
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: '#D9E2EC' }} aria-hidden="true" />
      <div className="max-w-3xl mx-auto px-5 md:px-8">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          data-testid="faq-header"
        >
          <span
            className="text-xs tracking-[0.3em] uppercase mb-4 block"
            style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}
          >
            {dict.faq.sectionLabel}
          </span>
          <h2
            className="text-4xl md:text-5xl font-bold mb-5"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}
          >
            {dict.faq.heading}
          </h2>
          <div
            className="mx-auto"
            style={{ width: '60px', height: '3px', background: 'linear-gradient(90deg, #C79A35, #E4B84B)', borderRadius: '2px' }}
          />
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              className="rounded-2xl overflow-hidden"
              style={{
                background: '#FFFFFF',
                border: openIndex === i ? '1px solid rgba(199,154,53,0.5)' : '1px solid #D9E2EC',
                boxShadow: openIndex === i ? '0 4px 20px rgba(16,42,67,0.08)' : '0 1px 4px rgba(16,42,67,0.04)',
                transition: 'border-color 0.25s, box-shadow 0.25s',
              }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              data-testid={`faq-item-${i}`}
            >
              <button
                className="w-full flex items-center justify-between p-6 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C79A35]"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                data-testid={`faq-toggle-${i}`}
              >
                <span
                  className="text-base font-medium pr-4 transition-colors duration-300"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    color: openIndex === i ? '#C79A35' : '#102A43',
                  }}
                >
                  {faq.question}
                </span>
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300"
                  style={{
                    background: openIndex === i ? '#C79A35' : 'rgba(199,154,53,0.1)',
                    border: openIndex === i ? 'none' : '1px solid rgba(199,154,53,0.3)',
                  }}
                >
                  {openIndex === i
                    ? <Minus size={14} style={{ color: '#102A43' }} aria-hidden="true" />
                    : <Plus size={14} style={{ color: '#C79A35' }} aria-hidden="true" />}
                </div>
              </button>

              <AnimatePresence initial={false}>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                    data-testid={`faq-answer-${i}`}
                  >
                    <div className="px-6 pb-6">
                      <div
                        className="h-px mb-4"
                        style={{ background: 'linear-gradient(90deg, rgba(199,154,53,0.3), transparent)' }}
                        aria-hidden="true"
                      />
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
                      >
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
