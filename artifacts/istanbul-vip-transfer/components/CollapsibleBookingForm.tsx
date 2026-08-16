'use client';

import { useState } from 'react';
import { ChevronDown, CalendarCheck } from 'lucide-react';
import BookingForm from './BookingForm';
import { useLang } from '@/lib/i18n/context';

/**
 * Wraps BookingForm in a collapsible accordion for service and blog pages.
 * Default: closed. Clicking the header expands the form.
 * Homepage uses <BookingForm /> directly (always expanded).
 */
export default function CollapsibleBookingForm() {
  const [open, setOpen] = useState(false);
  const { dict } = useLang();
  const b = dict.booking;

  return (
    <div id="rezervasyon" className="scroll-mt-24">
      {/* ── Toggle header ── */}
      <div
        style={{
          background: 'linear-gradient(160deg, #FDFBF6 0%, #EBF4FF 50%, #F3EFFD 100%)',
          borderTop: '1px solid #D9E2EC',
          borderBottom: open ? 'none' : '1px solid #D9E2EC',
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-5">
          <button
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            aria-controls="collapsible-booking-form-content"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(199,154,53,0.12)',
                  flexShrink: 0,
                }}
              >
                <CalendarCheck size={20} style={{ color: '#C79A35' }} />
              </span>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: '#C79A35',
                  }}
                >
                  {b.sectionLabel}
                </p>
                <p
                  style={{
                    margin: '2px 0 0',
                    fontFamily: 'Playfair Display, Georgia, serif',
                    fontSize: 'clamp(16px, 3vw, 22px)',
                    fontWeight: 700,
                    color: '#102A43',
                  }}
                >
                  {b.sectionTitle}
                </p>
              </div>
            </div>

            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                background: open ? '#F1F5F9' : '#102A43',
                color: open ? '#52677A' : '#fff',
                fontSize: '13px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              {open ? (b.collapse ?? 'Kapat') : (b.expand ?? 'Fiyat Al')}
              <ChevronDown
                size={16}
                style={{
                  transition: 'transform 0.25s ease',
                  transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </span>
          </button>
        </div>
      </div>

      {/* ── Form content ── */}
      {open && (
        <div
          id="collapsible-booking-form-content"
          style={{
            animation: 'slideDown 0.2s ease',
          }}
        >
          <style>{`@keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
          <BookingForm />
        </div>
      )}
    </div>
  );
}
