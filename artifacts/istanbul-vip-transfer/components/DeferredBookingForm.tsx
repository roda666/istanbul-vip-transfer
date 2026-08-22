'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n/context';
import { useHomepageCms } from '@/lib/homepage-cms-context';

// The full reservation UI includes validation, location comboboxes and several
// optional-field requests. It is intentionally split out of the initial hero
// bundle, but is loaded immediately when a visitor asks to book.
const BookingForm = dynamic(() => import('./BookingForm'), {
  ssr: false,
  loading: () => (
    <div
      className="min-h-40"
      aria-busy="true"
      aria-label="Rezervasyon formu hazırlanıyor"
    />
  ),
});

export default function DeferredBookingForm() {
  const sectionRef = useRef<HTMLElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const { dict } = useLang();
  const b = dict.booking;
  const cms = useHomepageCms();
  const homepageSection = cms?.reservationSection;

  useEffect(() => {
    const loadForm = () => setShouldLoad(true);
    document.addEventListener('ivt:booking-open', loadForm);

    const target = sectionRef.current;
    if (!target || !('IntersectionObserver' in window)) {
      return () => document.removeEventListener('ivt:booking-open', loadForm);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      // Do not start the heavy form while the hero is the mobile LCP. The CTA
      // event above still loads it instantly when a visitor asks for a quote.
      { rootMargin: '0px 0px -15%' },
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
      document.removeEventListener('ivt:booking-open', loadForm);
    };
  }, []);

  if (homepageSection && !homepageSection.enabled) return null;

  return (
    <section
      ref={sectionRef}
      id="rezervasyon"
      className="scroll-mt-24"
      data-testid="booking-section-shell"
    >
      {shouldLoad ? (
        <BookingForm sectionId="booking-form-content" homepageMode />
      ) : (
        <div
          className="py-16 px-5 text-center"
          style={{ background: 'linear-gradient(160deg, #F8F0DF 0%, #E4F1F8 48%, #EEEAF8 100%)' }}
        >
          <span
            className="text-xs tracking-[0.3em] uppercase mb-4 block"
            style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}
          >
            {homepageSection?.eyebrow ?? b.sectionLabel}
          </span>
          <h2
            className="text-3xl sm:text-4xl font-bold mb-4"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}
          >
            {homepageSection?.heading ?? b.sectionTitle}
          </h2>
          <p className="text-base max-w-lg mx-auto mb-7" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
            {homepageSection?.description ?? b.sectionDescription}
          </p>
          <button
            type="button"
            onClick={() => setShouldLoad(true)}
            className="px-6 py-3 rounded-xl text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C79A35] focus-visible:ring-offset-2"
            style={{ background: '#102A43', color: '#FFFFFF', fontFamily: 'Inter, sans-serif' }}
          >
            {b.expand ?? 'Fiyat Al'}
          </button>
        </div>
      )}
    </section>
  );
}