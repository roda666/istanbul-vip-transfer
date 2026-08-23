'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { slugify } from '@/lib/ai/slugify';
import type { PublicServiceCategory } from '@/lib/public-service-catalog-types';

export default function CreateServicePageForm({ categories }: { categories: PublicServiceCategory[] }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
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