'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { slugify } from '@/lib/ai/slugify';
import type { PublicServiceCategory } from '@/lib/public-service-catalog-types';

interface Props {
  categories: PublicServiceCategory[];
  /** Pre-fills the slug field — used when creating content for a Service
   * slug already registered in PAGE_REGISTRY but missing from the CMS. */
  initialSlug?: string;
  /** Pre-fills the title field, paired with initialSlug. */
  initialTitle?: string;
}

export default function CreateServicePageForm({ categories, initialSlug, initialTitle }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle ?? '');
  const [slug, setSlug] = useState(initialSlug ?? '');
  const [category, setCategory] = useState(categories[0]?.slug ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const response = await fetch('/admin/api/service-pages/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, slug, category }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok || !data.id) {
      setError(data.error ?? 'Hizmet oluşturulamadı.');
      return;
    }
    router.push(`/admin/hizmetler/${data.id}`);
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: '680px', display: 'grid', gap: '16px' }}>
      {initialSlug && (
        <p style={{
          margin: 0, padding: '10px 14px', fontSize: '13px', color: '#B45309',
          background: '#FFF7ED', border: '1px solid #FBBF24', borderRadius: '8px',
          fontFamily: 'Inter, sans-serif', lineHeight: 1.5,
        }}>
          ⚠ &quot;{initialSlug}&quot; slug&apos;ı PAGE_REGISTRY&apos;de kayıtlı ama veritabanında hiç içeriği yok —
          bu form o eksik kaydı oluşturacak.
        </p>
      )}
      <p style={{ margin: 0, color: '#50677A', fontSize: '14px', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
        İlk taslak oluşturulduktan sonra içerik, SEO, görseller ve çeviriler için hizmet sayfası editörüne yönlendirileceksiniz.
      </p>
      <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
        Hizmet adı
        <input
          value={title}
          onChange={(event) => {
            const value = event.target.value;
            setTitle(value);
            setSlug(slugify(value));
          }}
          required
          style={{ padding: '10px', border: '1px solid #CBD5E1', borderRadius: '7px' }}
        />
      </label>
      <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
        URL slug
        <input
          value={slug}
          onChange={(event) => setSlug(event.target.value.toLowerCase())}
          pattern="[a-z0-9-]+"
          required
          style={{ padding: '10px', border: '1px solid #CBD5E1', borderRadius: '7px' }}
        />
      </label>
      <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
        Kategori
        <select value={category} onChange={(event) => setCategory(event.target.value)} required style={{ padding: '10px', border: '1px solid #CBD5E1', borderRadius: '7px' }}>
          {categories.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}
        </select>
      </label>
      {error && <p role="alert" style={{ margin: 0, color: '#B42318', fontSize: '13px' }}>{error}</p>}
      <button disabled={saving || categories.length === 0} type="submit" style={{ width: 'fit-content', padding: '10px 18px', border: 0, borderRadius: '7px', background: '#C9A84C', color: '#102A43', fontWeight: 700, cursor: 'pointer' }}>
        {saving ? 'Oluşturuluyor…' : 'Taslağı Oluştur ve Düzenle'}
      </button>
    </form>
  );
}