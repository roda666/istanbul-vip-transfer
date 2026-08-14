'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

function slugify(t: string) {
  return t.toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/\s+/g, '-').replace(/[^\w-]/g, '').replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 180);
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB',
  borderRadius: '8px', fontSize: '14px', fontFamily: 'Inter, sans-serif',
  color: '#1E293B', background: '#FFFFFF', boxSizing: 'border-box',
};

export default function YeniBlogPage() {
  const router = useRouter();
  const [title,   setTitle]   = useState('');
  const [slug,    setSlug]    = useState('');
  const [status,  setStatus]  = useState<'IDEA' | 'DRAFT'>('IDEA');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Başlık zorunludur.'); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch('/admin/api/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), slug: slug.trim() || undefined, status }),
      });
      const json = await res.json() as { id?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Oluşturulamadı.');
      router.push(`/admin/blog/${json.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata.');
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '28px 24px', maxWidth: '540px' }}>
      <Link href="/admin/blog" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748B', fontSize: '13px', fontFamily: 'Inter, sans-serif', textDecoration: 'none', marginBottom: '20px' }}>
        <ArrowLeft size={14} /> Blog
      </Link>

      <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1E293B', fontFamily: 'Inter, sans-serif', marginBottom: '4px' }}>Yeni Blog Yazısı</h1>
      <p style={{ fontSize: '13px', color: '#64748B', fontFamily: 'Inter, sans-serif', marginBottom: '24px' }}>
        Başlık ve durum seçtikten sonra tam editöre yönlendirileceksiniz.
      </p>

      {error && (
        <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '13px', color: '#B91C1C', marginBottom: '16px', fontFamily: 'Inter, sans-serif' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', fontFamily: 'Inter, sans-serif', display: 'block', marginBottom: '6px' }}>
            Başlık *
          </label>
          <input value={title} onChange={e => { setTitle(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }}
            placeholder="Blog yazısı başlığı" required style={inp} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', fontFamily: 'Inter, sans-serif', display: 'block', marginBottom: '6px' }}>
            Slug (opsiyonel — otomatik oluşturulur)
          </label>
          <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder={title ? slugify(title) : 'ornek-blog-yazisi'} style={inp} />
          <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', fontFamily: 'Inter, sans-serif' }}>
            URL: /blog/{slug || (title ? slugify(title) : '…')}
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', fontFamily: 'Inter, sans-serif', display: 'block', marginBottom: '6px' }}>
            Başlangıç Durumu
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            {(['IDEA', 'DRAFT'] as const).map(s => (
              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontFamily: 'Inter, sans-serif', cursor: 'pointer', color: '#374151' }}>
                <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} />
                {s === 'IDEA' ? '💡 Fikir' : '📝 Taslak'}
              </label>
            ))}
          </div>
        </div>

        <button type="submit" disabled={loading || !title.trim()} style={{
          padding: '10px 24px', background: loading ? '#93C5FD' : '#2563EB', color: '#FFFFFF',
          border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'Inter, sans-serif',
        }}>
          {loading ? 'Oluşturuluyor…' : 'Oluştur ve Düzenle →'}
        </button>
      </form>
    </div>
  );
}
