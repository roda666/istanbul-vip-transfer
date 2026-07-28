'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Sparkles, Trash2, X, AlertCircle } from 'lucide-react';
import AdminPageHeader from '../../_components/AdminPageHeader';

interface AISuggestion {
  id: string;
  suggestedTitle: string | null;
  primaryKeyword: string | null;
  status: string;
  createdAt: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', background: '#FFFFFF',
  border: '1px solid #D8E1E9', borderRadius: '8px',
  color: '#172B3A', fontSize: '13px', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', color: '#52697A', fontSize: '11px', fontFamily: 'Inter, sans-serif',
  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600,
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekliyor', IN_PROGRESS: 'İşlemde', COMPLETE: 'Tamamlandı', REJECTED: 'Reddedildi',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING:     { bg: '#FFFBEB', text: '#D97706' },
  IN_PROGRESS: { bg: '#EFF6FF', text: '#2563EB' },
  COMPLETE:    { bg: '#F0FDF4', text: '#168C5B' },
  REJECTED:    { bg: '#FEF2F2', text: '#D64545' },
};

export default function AiOnerilerPage() {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  const [suggestedTitle, setSuggestedTitle] = useState('');
  const [primaryKeyword, setPrimaryKeyword] = useState('');
  const [secondaryKeywords, setSecondaryKeywords] = useState('');
  const [searchIntent, setSearchIntent] = useState('');
  const [articleType, setArticleType] = useState('');
  const [targetService, setTargetService] = useState('');
  const [targetLocation, setTargetLocation] = useState('');

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/admin/api/ai-suggestions');
      const data = await res.json();
      setSuggestions(data.items ?? []);
    } catch { setSuggestions([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFormError('');
    try {
      const res = await fetch('/admin/api/ai-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestedTitle, primaryKeyword, secondaryKeywords, searchIntent, articleType, targetService, targetLocation }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setFormError(data.error || 'Kaydedilemedi.'); return; }
      setShowForm(false); setSuggestedTitle(''); setPrimaryKeyword(''); setSecondaryKeywords('');
      setSearchIntent(''); setArticleType(''); setTargetService(''); setTargetLocation('');
      fetchSuggestions();
    } catch { setFormError('Sunucu hatası.'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu öneriyi silmek istediğinizden emin misiniz?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/admin/api/ai-suggestions/${id}`, { method: 'DELETE' });
      if (res.ok) fetchSuggestions();
    } catch { /* ignore */ }
    finally { setDeleting(null); }
  }

  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="AI İçerik Önerileri"
        description="İçerik stratejisi ve araştırma yönetimi"
        action={
          <button onClick={() => setShowForm(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: '#2563EB', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            <Plus size={15} /> Yeni Öneri
          </button>
        }
      />

      {/* AI disabled notice */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px' }}>
        <AlertCircle size={16} style={{ color: '#D97706', flexShrink: 0, marginTop: '1px' }} />
        <div>
          <p style={{ color: '#92400E', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 600, margin: '0 0 4px' }}>AI Bağlantısı</p>
          <p style={{ color: '#78350F', fontSize: '12px', fontFamily: 'Inter, sans-serif', margin: 0 }}>AI bağlantısı sonraki aşamada etkinleştirilecek. Şu an manuel öneri ve araştırma kaydı yapabilirsiniz.</p>
        </div>
      </div>

      {/* New suggestion form */}
      {showForm && (
        <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(23,43,58,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ color: '#172B3A', fontSize: '14px', fontFamily: 'Inter, sans-serif', fontWeight: 600, margin: 0 }}>Yeni İçerik Önerisi</h3>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#718596', cursor: 'pointer' }}><X size={16} /></button>
          </div>
          {formError && <p style={{ color: '#D64545', fontSize: '12px', fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>{formError}</p>}
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Öneri Başlığı</label>
              <input type="text" value={suggestedTitle} onChange={(e) => setSuggestedTitle(e.target.value)} style={inputStyle} placeholder="Makale başlığı önerisi" />
            </div>
            <div>
              <label style={labelStyle}>Birincil Anahtar Kelime</label>
              <input type="text" value={primaryKeyword} onChange={(e) => setPrimaryKeyword(e.target.value)} style={inputStyle} placeholder="ana anahtar kelime" />
            </div>
            <div>
              <label style={labelStyle}>İkincil Anahtar Kelimeler</label>
              <input type="text" value={secondaryKeywords} onChange={(e) => setSecondaryKeywords(e.target.value)} style={inputStyle} placeholder="virgülle ayırın" />
            </div>
            <div>
              <label style={labelStyle}>Arama Amacı</label>
              <select value={searchIntent} onChange={(e) => setSearchIntent(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">Seçin...</option>
                {['Bilgilendirme', 'Ticari', 'Navigasyon', 'İşlem'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Makale Türü</label>
              <input type="text" value={articleType} onChange={(e) => setArticleType(e.target.value)} style={inputStyle} placeholder="Rehber, Liste, Karşılaştırma..." />
            </div>
            <div>
              <label style={labelStyle}>Hedef Hizmet</label>
              <input type="text" value={targetService} onChange={(e) => setTargetService(e.target.value)} style={inputStyle} placeholder="IST Transfer, VIP Transfer..." />
            </div>
            <div>
              <label style={labelStyle}>Hedef Konum</label>
              <input type="text" value={targetLocation} onChange={(e) => setTargetLocation(e.target.value)} style={inputStyle} placeholder="İstanbul, Sabiha Gökçen..." />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button type="submit" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: saving ? '#93C5FD' : '#2563EB', color: '#FFFFFF', fontWeight: 600, fontSize: '13px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              <button type="button" disabled title="AI bağlantısı sonraki aşamada etkinleştirilecek."
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: '#F8FAFC', color: '#A0B0BC', fontWeight: 600, fontSize: '13px', border: '1px solid #D8E1E9', cursor: 'not-allowed' }}>
                <Sparkles size={13} /> AI ile Oluştur
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: '8px', background: '#FFFFFF', color: '#52697A', fontSize: '13px', border: '1px solid #D8E1E9', cursor: 'pointer' }}>İptal</button>
            </div>
          </form>
        </div>
      )}

      {/* Suggestions list */}
      {loading ? (
        <p style={{ color: '#718596', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>Yükleniyor...</p>
      ) : suggestions.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
          <Sparkles size={24} style={{ color: '#D8E1E9', marginBottom: '12px' }} />
          <p style={{ color: '#718596', fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>Henüz öneri yok. İlk içerik önerinizi ekleyin.</p>
        </div>
      ) : (
        <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', overflow: 'hidden' }}>
          {suggestions.map((s, i) => {
            const statusStyle = STATUS_COLORS[s.status] ?? { bg: '#F8FAFC', text: '#64748B' };
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: i < suggestions.length - 1 ? '1px solid #EDF2F7' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: '#172B3A', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.suggestedTitle || '(başlıksız)'}</p>
                  {s.primaryKeyword && <p style={{ color: '#718596', fontSize: '11px', fontFamily: 'monospace', margin: 0 }}>{s.primaryKeyword}</p>}
                </div>
                <span style={{ padding: '2px 8px', borderRadius: '4px', background: statusStyle.bg, color: statusStyle.text, fontSize: '10px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{STATUS_LABELS[s.status] ?? s.status}</span>
                <button onClick={() => handleDelete(s.id)} disabled={deleting === s.id} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '6px', background: '#FEF2F2', color: '#D64545', border: 'none', cursor: 'pointer', opacity: deleting === s.id ? 0.5 : 1, flexShrink: 0 }}><Trash2 size={13} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
