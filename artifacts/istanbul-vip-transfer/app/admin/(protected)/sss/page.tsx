'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Check } from 'lucide-react';
import AdminPageHeader from '../../_components/AdminPageHeader';
import { AdminRecordActions } from '../../_components/AdminRecordActions';
import { AIWriteAssist } from '../../_components/AIWriteAssist';
import { AdminActionButton } from '../../_components/AdminActionButton';

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
  background: '#FFFFFF',
  border: '1px solid #D8E1E9',
  borderRadius: '8px',
  color: '#172B3A',
  fontSize: '13px',
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', color: '#52697A', fontSize: '11px', fontFamily: 'Inter, sans-serif',
  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '5px', fontWeight: 600,
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
        fetch('/admin/api/faqs'),
        fetch('/admin/api/content?limit=100'),
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
      const url = editId ? `/admin/api/faqs/${editId}` : '/admin/api/faqs';
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
      const res = await fetch(`/admin/api/faqs/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
      else alert('Silme başarısız.');
    } catch { alert('Sunucu hatası.'); }
    finally { setDeleting(null); }
  }

  async function moveFaq(id: string, direction: 'up' | 'down') {
    const index = faqs.findIndex(f => f.id === id);
    const other = faqs[index + (direction === 'up' ? -1 : 1)];
    if (!other) return;
    setFaqs(prev => {
      const next = [...prev];
      [next[index], next[index + (direction === 'up' ? -1 : 1)]] = [next[index + (direction === 'up' ? -1 : 1)], next[index]];
      return next;
    });
    const res = await fetch(`/admin/api/faqs/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: direction }),
    });
    if (!res.ok) fetchData();
  }

  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="SSS Yönetimi"
        description="Sıkça sorulan soruları yönetin"
        action={
          <AdminActionButton onClick={openCreate} label="Yeni SSS" icon={Plus} variant="new" />
        }
      />

      {/* Form */}
      {showForm && (
        <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(23,43,58,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ color: '#172B3A', fontSize: '14px', fontFamily: 'Inter, sans-serif', fontWeight: 600, margin: 0 }}>{editId ? 'SSS Düzenle' : 'Yeni SSS'}</h3>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#718596', cursor: 'pointer' }}><X size={16} /></button>
          </div>
          {formError && <p style={{ color: '#D64545', fontSize: '12px', fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>{formError}</p>}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>İlgili İçerik</label>
              <select value={contentId} onChange={(e) => setContentId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }} required>
                <option value="">Seçin...</option>
                {contentOptions.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Soru *</label>
              <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} style={inputStyle} required maxLength={500} placeholder="Sıkça sorulan soru" />
              <AIWriteAssist context="faq" field="faq_question" label="SSS sorusu" value={question} onChange={setQuestion} maxLength={500} />
            </div>
            <div>
              <label style={labelStyle}>Cevap *</label>
              <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} required />
              <AIWriteAssist context="faq" field="faq_answer" label="SSS cevabı" value={answer} onChange={setAnswer} maxLength={5_000} />
            </div>
            <div>
              <label style={labelStyle}>Sıra</label>
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value))} style={{ ...inputStyle, width: '80px' }} min={0} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <AdminActionButton type="submit" label="Kaydet" icon={Check} variant="save" loading={saving} />
              <AdminActionButton type="button" label="İptal" variant="cancel" manage={false} onClick={() => setShowForm(false)} />
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p style={{ color: '#718596', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>Yükleniyor...</p>
      ) : error ? (
        <p style={{ color: '#D64545', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>{error}</p>
      ) : faqs.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
          <p style={{ color: '#718596', fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>Henüz SSS yok.</p>
        </div>
      ) : (
        <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', overflow: 'hidden' }}>
          {faqs.map((faq, i) => (
            <div key={faq.id} style={{ padding: '14px 16px', borderBottom: i < faqs.length - 1 ? '1px solid #EDF2F7' : 'none', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#172B3A', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500, margin: '0 0 4px' }}>{faq.question}</p>
                <p style={{ color: '#718596', fontSize: '12px', fontFamily: 'Inter, sans-serif', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{faq.answer}</p>
              </div>
              <span style={{ color: '#A0B0BC', fontSize: '11px', fontFamily: 'monospace', flexShrink: 0 }}>#{faq.sortOrder}</span>
              <div style={{ flexShrink: 0 }}>
                <AdminRecordActions
                  up={{ onClick: () => moveFaq(faq.id, 'up'), disabled: i === 0 }}
                  down={{ onClick: () => moveFaq(faq.id, 'down'), disabled: i === faqs.length - 1 }}
                  edit={{ onClick: () => openEdit(faq) }}
                  delete={{ onClick: () => handleDelete(faq.id), disabled: deleting === faq.id }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
