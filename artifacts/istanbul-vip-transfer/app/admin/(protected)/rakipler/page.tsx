'use client';

import { useCallback, useEffect, useState } from 'react';
import { Globe2, Loader2, Pencil, Trash2, X, Check, AlertTriangle } from 'lucide-react';
import AdminPageHeader from '@/app/admin/_components/AdminPageHeader';

type Competitor = { id: number; domain: string; label: string; notes: string | null; active: boolean };
type Analysis = {
  domains: Array<{ domain: string; label: string; status: 'ok' | 'unavailable'; sourceUrl?: string; scanned: number; error?: string }>;
  gaps: Array<{ domain: string; label: string; sourceUrl: string; url: string; topic: string }>;
  ownPublishedPostCount: number;
  note: string;
};
const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 10px', border: '1px solid #D8E1E9', borderRadius: 7, fontSize: 13, color: '#172B3A' };
const button: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 };

export default function RakiplerPage() {
  const [items, setItems] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState({ domain: '', label: '', notes: '', active: true });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/admin/api/competitors');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Rakip listesi yüklenemedi.');
      setItems(data.items ?? []);
      setMessage(data.analysisLabel ?? '');
    } catch (e) { setError(e instanceof Error ? e.message : 'Rakip listesi yüklenemedi.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  function reset() { setEditing(null); setForm({ domain: '', label: '', notes: '', active: true }); }
  function edit(item: Competitor) {
    setEditing(item.id);
    setForm({ domain: item.domain, label: item.label, notes: item.notes ?? '', active: item.active });
    setError('');
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    const isEdit = editing !== null;
    try {
      const response = await fetch(isEdit ? `/admin/api/competitors/${editing}` : '/admin/api/competitors', {
        method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { label: form.label, notes: form.notes || null, active: form.active } : form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Kaydedilemedi.');
      setItems(previous => isEdit ? previous.map(item => item.id === data.item.id ? data.item : item) : [...previous, data.item].sort((a, b) => a.label.localeCompare(b.label, 'tr')));
      reset();
    } catch (e) { setError(e instanceof Error ? e.message : 'Kaydedilemedi.'); }
    finally { setSaving(false); }
  }
  async function remove(item: Competitor) {
    if (!confirm(`${item.label} silinsin mi? Bu işlem geri alınamaz.`)) return;
    setError('');
    try {
      const response = await fetch(`/admin/api/competitors/${item.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Silinemedi.');
      setItems(previous => previous.filter(row => row.id !== item.id));
      if (editing === item.id) reset();
    } catch (e) { setError(e instanceof Error ? e.message : 'Silinemedi.'); }
  }
  async function analyze() {
    setAnalyzing(true); setError(''); setMessage('');
    try {
      const response = await fetch('/admin/api/competitors/analyze', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Rakip konu analizi yapılamadı.');
      setAnalysis(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Rakip konu analizi yapılamadı.'); }
    finally { setAnalyzing(false); }
  }

  return <div style={{ padding: '28px 24px', maxWidth: 920 }}>
    <AdminPageHeader title="Rakip Siteler" description="Aktif rakiplerin herkese açık sitemap kaynaklarından, istek üzerine konu boşluklarını karşılaştırın." />
    {error && <div style={{ marginBottom: 14, padding: 11, color: '#B42318', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8 }}>{error}</div>}
    {message && <div style={{ display: 'flex', gap: 8, marginBottom: 18, padding: 12, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, color: '#92400E', fontSize: 13 }}><AlertTriangle size={17} />{message}</div>}
    <section style={{ marginBottom: 18, padding: 16, borderRadius: 10, border: '1px solid #BFDBFE', background: '#F8FBFF' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div><strong style={{ fontSize: 14, color: '#172B3A' }}>Rakip konu boşluğu analizi</strong><p style={{ color: '#52697A', fontSize: 12, margin: '5px 0 0' }}>Yalnızca aktif alan adlarının açık sitemap’leri ve erişilebilen sayfa başlıkları kullanılır. En fazla 24 URL/alan adı taranır.</p></div>
        <button onClick={analyze} disabled={analyzing || loading || items.filter(item => item.active).length === 0} style={{ ...button, background: '#2563EB', color: '#fff', opacity: analyzing || loading ? .7 : 1 }}>{analyzing ? <Loader2 size={14} /> : <Globe2 size={14} />}{analyzing ? 'Analiz ediliyor…' : 'Konu boşluklarını analiz et'}</button>
      </div>
      {analysis && <div style={{ marginTop: 16, fontSize: 12 }}>
        <p style={{ color: '#52697A', margin: '0 0 10px' }}>{analysis.note} Sitede karşılaştırılan yayımlı blog: {analysis.ownPublishedPostCount}.</p>
        {analysis.domains.map(domain => <div key={domain.domain} style={{ padding: '8px 0', borderTop: '1px solid #DCEAF8', color: domain.status === 'ok' ? '#276749' : '#B42318' }}>
          <strong>{domain.label}</strong> ({domain.domain}) — {domain.status === 'ok' ? `${domain.scanned} sayfa incelendi.` : `Kullanılamıyor: ${domain.error}`}
          {domain.sourceUrl && <> Kaynak: <a href={domain.sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#1D4ED8' }}>{domain.sourceUrl}</a></>}
        </div>)}
        <h3 style={{ color: '#172B3A', fontSize: 13, margin: '15px 0 7px' }}>Kapsamadığımız rakip konular ({analysis.gaps.length})</h3>
        {analysis.gaps.length === 0 ? <p style={{ color: '#52697A', margin: 0 }}>Erişilebilen kaynaklarda karşılaştırmaya uygun, kapsanmayan bir konu bulunamadı. Bu sonuç konu üretildiği anlamına gelmez.</p> :
          <div style={{ display: 'grid', gap: 7 }}>{analysis.gaps.map(gap => <div key={`${gap.domain}-${gap.url}`} style={{ padding: 10, background: '#fff', border: '1px solid #D8E1E9', borderRadius: 7 }}><strong style={{ color: '#172B3A' }}>{gap.topic}</strong><div style={{ color: '#52697A', marginTop: 3 }}>{gap.label} ({gap.domain}) · <a href={gap.url} target="_blank" rel="noreferrer" style={{ color: '#1D4ED8' }}>Sayfa kaynağı</a> · <a href={gap.sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#1D4ED8' }}>Sitemap</a></div></div>)}</div>}
      </div>}
    </section>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 310px', gap: 18, alignItems: 'start' }}>
      <section style={{ background: '#fff', border: '1px solid #D8E1E9', borderRadius: 10 }}>
        {loading ? <p style={{ padding: 24, color: '#718596' }}><Loader2 size={14} /> Yükleniyor…</p> : items.length === 0 ? <p style={{ padding: 30, color: '#718596', textAlign: 'center' }}>Henüz rakip alan adı eklenmedi.</p> : items.map((item, index) =>
          <div key={item.id} style={{ display: 'flex', gap: 12, padding: 15, borderBottom: index < items.length - 1 ? '1px solid #EDF2F7' : undefined }}>
            <Globe2 size={18} color="#2563EB" style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}><strong style={{ fontSize: 13, color: '#172B3A' }}>{item.label}</strong><div style={{ fontSize: 12, color: '#52697A', marginTop: 3 }}>{item.domain} {!item.active && <em style={{ color: '#B45309' }}>• Pasif</em>}</div>{item.notes && <p style={{ fontSize: 12, color: '#718596', margin: '6px 0 0' }}>{item.notes}</p>}</div>
            <div style={{ display: 'flex', gap: 5, height: 31 }}><button title="Düzenle" onClick={() => edit(item)} style={{ ...button, color: '#1D4ED8', background: '#EFF6FF' }}><Pencil size={14} /></button><button title="Sil" onClick={() => remove(item)} style={{ ...button, color: '#B42318', background: '#FEF2F2' }}><Trash2 size={14} /></button></div>
          </div>)}
      </section>
      <section style={{ background: '#fff', border: '1px solid #D8E1E9', borderRadius: 10, padding: 16 }}>
        <h2 style={{ fontSize: 14, margin: '0 0 14px', color: '#172B3A' }}>{editing ? 'Rakibi Düzenle' : 'Rakip Ekle'}</h2>
        <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
          <label style={{ fontSize: 12, color: '#52697A' }}>Görünen ad<input required value={form.label} onChange={e => setForm(current => ({ ...current, label: e.target.value }))} style={{ ...field, marginTop: 4 }} /></label>
          <label style={{ fontSize: 12, color: '#52697A' }}>Alan adı<input required disabled={editing !== null} placeholder="ornek.com" value={form.domain} onChange={e => setForm(current => ({ ...current, domain: e.target.value }))} style={{ ...field, marginTop: 4, background: editing ? '#F8FAFC' : '#fff' }} /></label>
          <label style={{ fontSize: 12, color: '#52697A' }}>Notlar (opsiyonel)<textarea value={form.notes} onChange={e => setForm(current => ({ ...current, notes: e.target.value }))} maxLength={2000} rows={3} style={{ ...field, marginTop: 4, resize: 'vertical' }} /></label>
          <label style={{ display: 'flex', gap: 7, fontSize: 12, color: '#52697A', alignItems: 'center' }}><input type="checkbox" checked={form.active} onChange={e => setForm(current => ({ ...current, active: e.target.checked }))} /> Aktif</label>
          <div style={{ display: 'flex', gap: 7 }}><button type="submit" disabled={saving} style={{ ...button, background: '#2563EB', color: '#fff' }}>{saving ? <Loader2 size={14} /> : <Check size={14} />}{saving ? 'Kaydediliyor' : 'Kaydet'}</button>{editing !== null && <button type="button" onClick={reset} style={{ ...button, background: '#F1F5F9', color: '#52697A' }}><X size={14} /> İptal</button>}</div>
        </form>
      </section>
    </div>
  </div>;
}