'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface FAQItem {
  q: string;
  a: string;
}

interface ServiceFAQProps {
  items: FAQItem[];
  heading?: string;
}

export default function ServiceFAQ({
  items,
  heading = 'Sık Sorulan Sorular',
}: ServiceFAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) =>
    setOpenIndex((prev) => (prev === i ? null : i));

  return (
    <section className="py-16 md:py-20" style={{ background: '#0A0A0A' }}>
      <div className="max-w-3xl mx-auto px-5 md:px-8">
        {/* Heading */}
        <div className="text-center mb-12">
          <p
            className="text-xs tracking-[0.25em] uppercase mb-4"
            style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
          >
            SSS
          </p>
          <h2
            className="text-2xl md:text-3xl font-bold"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#FFFFFF' }}
          >
            {heading}
          </h2>
          <div
            className="mx-auto mt-4"
            style={{
              width: '48px',
              height: '1px',
              background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)',
            }}
          />
        </div>

        {/* Items */}
        <div className="space-y-2">
          {items.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                style={{
                  border: '1px solid',
                  borderColor: isOpen ? 'rgba(201,168,76,0.35)' : 'rgba(201,168,76,0.1)',
                  borderRadius: '4px',
                  background: isOpen ? 'rgba(201,168,76,0.04)' : 'transparent',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
              >
                <button
                  onClick={() => toggle(i)}
                  aria-expanded={isOpen}
                  className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C9A84C] rounded"
                >
                  <span
                    className="text-sm leading-relaxed"
                    style={{ color: isOpen ? '#E5E5E5' : '#CCC', fontFamily: 'Inter, sans-serif' }}
                  >
                    {item.q}
                  </span>
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className="flex-shrink-0 mt-0.5 transition-transform duration-200"
                    style={{
                      color: '#C9A84C',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4">
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: '#888', fontFamily: 'Inter, sans-serif' }}
                    >
                      {item.a}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
