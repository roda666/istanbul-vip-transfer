/**
 * Placeholder shown while the real BookingForm chunk is downloading
 * (dynamic(..., { ssr: false })). Mirrors the form's panel/field layout so the
 * page doesn't flash a blank box — visitors see something that already looks
 * like "the form is here", not a broken/empty section.
 */
export default function BookingFormSkeleton() {
  return (
    <div
      className="ivt-bk-skeleton"
      aria-busy="true"
      aria-label="Rezervasyon formu yükleniyor"
      style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        padding: '24px',
        maxWidth: '960px',
        margin: '0 auto',
      }}
    >
      <div className="ivt-bk-skeleton-bar" style={{ width: '40%', height: '14px', marginBottom: '20px' }} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6" style={{ marginBottom: '20px' }}>
        <div>
          <div className="ivt-bk-skeleton-bar" style={{ width: '55%', height: '10px', marginBottom: '10px' }} />
          <div className="ivt-bk-skeleton-bar" style={{ width: '100%', height: '44px' }} />
        </div>
        <div>
          <div className="ivt-bk-skeleton-bar" style={{ width: '55%', height: '10px', marginBottom: '10px' }} />
          <div className="ivt-bk-skeleton-bar" style={{ width: '100%', height: '44px' }} />
        </div>
        <div>
          <div className="ivt-bk-skeleton-bar" style={{ width: '45%', height: '10px', marginBottom: '10px' }} />
          <div className="ivt-bk-skeleton-bar" style={{ width: '100%', height: '44px' }} />
        </div>
        <div>
          <div className="ivt-bk-skeleton-bar" style={{ width: '45%', height: '10px', marginBottom: '10px' }} />
          <div className="ivt-bk-skeleton-bar" style={{ width: '100%', height: '44px' }} />
        </div>
      </div>
      <div className="ivt-bk-skeleton-bar" style={{ width: '160px', height: '48px', borderRadius: '10px' }} />
      <style>{`
        .ivt-bk-skeleton-bar {
          background: linear-gradient(90deg, #EEF2F6 25%, #F7F9FB 37%, #EEF2F6 63%);
          background-size: 400% 100%;
          border-radius: 8px;
          animation: ivt-bk-shimmer 1.4s ease infinite;
        }
        @keyframes ivt-bk-shimmer {
          0% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}
