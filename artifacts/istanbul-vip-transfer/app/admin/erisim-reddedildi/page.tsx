import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default function AdminAccessDeniedPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F3F6FA', padding: 24 }}>
      <section style={{ maxWidth: 520, width: '100%', borderRadius: 16, background: '#fff', padding: 32, boxShadow: '0 12px 36px rgba(15, 23, 42, .12)' }}>
        <p style={{ color: '#B45309', fontWeight: 700, margin: 0 }}>Erişim reddedildi</p>
        <h1 style={{ color: '#0F172A', margin: '12px 0' }}>Bu alana erişim izniniz yok.</h1>
        <p style={{ color: '#475569', lineHeight: 1.6 }}>
          Hesabınız oturum açmış durumda, ancak bu yönetim işlemi için gerekli izne sahip değil.
        </p>
        <Link href="/admin/hesabim" style={{ display: 'inline-block', marginTop: 12, color: '#0F766E', fontWeight: 700 }}>
          Hesabıma dön
        </Link>
      </section>
    </main>
  );
}