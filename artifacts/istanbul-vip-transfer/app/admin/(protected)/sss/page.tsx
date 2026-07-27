'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Check, Loader2 } from 'lucide-react';
import AdminPageHeader from '../../_components/AdminPageHeader';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  contentId: string;
}

interface ContentOption {
  id: string;
  title: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: '#0F0F0F',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  color: '#e5e5e5',
  fontSize: '13px',
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
};

export default function SssPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [contentOptions, setContentOptions] = useState<ContentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [contentId, setContentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [faqsRes, contentRes] = await Promise.all([
        fetch('/api/admin/faqs'),
        fetch('/api/admin/content?limit=100'),
      ]);
      const faqsData = await faqsRes.json();
      const contentData = await contentRes.json();
      setFaqs(faqsData.items ?? []);
      setContentOptions((contentData.items ?? []).map((c: ContentOption & { title: string }) => ({ id: c.id, title: c.title })));
    } catch {
      setError('Veriler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreate() {
    setEditId(null); setQuestion(''); setAnswer(''); setSortOrder(0);
    setContentId(contentOptions[0]?.id ?? ''); setFormError(''); setShowForm(true);
  }

  function openEdit(faq: FAQ) {
    setEditId(faq.id); setQuestion(faq.question); setAnswer(faq.answer);
    setSortOrder(faq.sortOrder); setContentId(faq.contentId); setFormError(''); setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contentId) { setFormError('İçerik seçilmesi zorunludur.'); return; }
    setSaving(true); setFormError('');
    try {
      const url = editId ? `/api/admin/faqs/${editId}` : '/api/admin/faqs';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, answer, sortOrder, contentId }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setFormError(data.error || 'Kaydedilemedi.'); return; }
      setShowForm(false); fetchData();
    } catch { setFormError('Sunucu hatası.'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu SSS öğesini silmek istediğinizden emin misiniz?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/faqs/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
      else alert('Silme başarısız.');
    } catch { alert('Sunucu hatası.'); }
    finally { setDeleting(null); }
  }

  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="SSS Yönetimi"
        description="Sıkça sorulan soruları yönetin"
        action={
          <button onClick={openCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: '#C9A84C', color: '#0A0A0A', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            <Plus size={15} /> Yeni SSS
          </button>
        }
      />

      {/* Form */}
      {showForm && (
        <div style={{ background: '#161616', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ color: '#fff', fontSize: '14px', fontFamily: 'Inter, sans-serif', fontWeight: 600, margin: 0 }}>{editId ? 'SSS Düzenle' : 'Yeni SSS'}</h3>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={16} /></button>
          </div>
          {formError && <p style={{ color: '#f87171', fontSize: '12px', fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>{formError}</p>}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, sans-serif', marginBottom: '5px' }}>İlgili İçerik</label>
              <select value={contentId} onChange={(e) => setContentId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }} required>
                <option value="">Seçin...</option>
                {contentOptions.map((c) => <option key={c.id} value={c.id} style={{ background: '#0F0F0F' }}>{c.title}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, sans-serif', marginBottom: '5px' }}>Soru *</label>
              <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} style={inputStyle} required maxLength={500} placeholder="Sıkça sorulan soru" />
            </div>
            <div>
              <label style={{ display: 'block', color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, sans-serif', marginBottom: '5px' }}>Cevap *</label>
              <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} required />
            </div>
            <div>
              <label style={{ display: 'block', color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, sans-serif', marginBottom: '5px' }}>Sıra</label>
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value))} style={{ ...inputStyle, width: '80px' }} min={0} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: '#C9A84C', color: '#0A0A0A', fontWeight: 600, fontSize: '13px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? <Loader2 size={13} /> : <Check size={13} />} Kaydet
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', color: '#666', fontSize: '13px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>İptal</button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p style={{ color: '#555', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>Yükleniyor...</p>
      ) : error ? (
        <p style={{ color: '#f87171', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>{error}</p>
      ) : faqs.length === 0 ? (
        <div style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
          <p style={{ color: '#555', fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>Henüz SSS yok.</p>
        </div>
      ) : (
        <div style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden' }}>
          {faqs.map((faq, i) => (
            <div key={faq.id} style={{ padding: '14px 16px', borderBottom: i < faqs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#e5e5e5', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500, margin: '0 0 4px' }}>{faq.question}</p>
                <p style={{ color: '#555', fontSize: '12px', fontFamily: 'Inter, sans-serif', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{faq.answer}</p>
              </div>
              <span style={{ color: '#444', fontSize: '11px', fontFamily: 'monospace', flexShrink: 0 }}>#{faq.sortOrder}</span>
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                <button onClick={() => openEdit(faq)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '6px', background: 'rgba(201,168,76,0.1)', color: '#C9A84C', border: 'none', cursor: 'pointer' }}><Pencil size={13} /></button>
                <button onClick={() => handleDelete(faq.id)} disabled={deleting === faq.id} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: 'none', cursor: 'pointer', opacity: deleting === faq.id ? 0.5 : 1 }}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
