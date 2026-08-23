'use client';

/**
 * /admin/ai-oneriler — AI İçerik Merkezi (Araştırma → Taslak → Onay)
 *
 * Features:
 * - Dashboard stats (total / freshness alerts / pending / complete)
 * - AI-powered topic + keyword suggestion form
 * - Suggestion list with status badges, timeSensitive flag, cannibalization warning
 * - Link through to detail view for generate / quality / social / translate panels
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Sparkles, Trash2, ChevronRight, AlertTriangle,
  Clock, CheckCircle2, FileText, RefreshCw, X,
} from 'lucide-react';
import AdminPageHeader from '../../_components/AdminPageHeader';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AISuggestion {
  id: string;
  suggestedTitle: string | null;
  primaryKeyword: string | null;
  articleType: string | null;
  targetService: string | null;
  targetLocation: string | null;
  status: string;
  timeSensitive: boolean;
  cannibalWarning?: { hasConflict: boolean } | null;
  contentDraft: string | null;
  draftBlogPostId: string | null;
  createdAt: string;
}

// ── Design tokens ──────────────────────────────────────────────────────────────

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

const ARTICLE_TYPES = ['Rehber', 'Liste', 'Karşılaştırma', 'SSS', 'Vaka Analizi', 'Nasıl Yapılır'];
const INTENTS = ['Bilgilendirme', 'Ticari', 'Navigasyon', 'İşlem'];
const TONES = ['Profesyonel', 'Samimi', 'Heyecan Verici', 'Bilimsel', 'Rahat'];

function StatCard({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent: string }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: accent + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '22px', fontWeight: 700, color: '#172B3A', margin: 0 }}>{value}</p>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#718596', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AiOnerilerPage() {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting]  = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  // form fields
  const [articleType, setArticleType]         = useState('');
  const [targetService, setTargetService]     = useState('');
  const [targetLocation, setTargetLocation]   = useState('');
  const [customerProfile, setCustomerProfile] = useState('');
  const [targetCountry, setTargetCountry]     = useState('');
  const [searchIntent, setSearchIntent]       = useState('');
  const [tone, setTone]                       = useState('Profesyonel');
  const [wordCountTarget, setWordCountTarget] = useState(1500);
  const [competitorContext, setCompetitorContext] = useState('');
  const [targetLanguage, setTargetLanguage]   = useState('tr');

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/admin/api/ai-suggestions');
      const data = await res.json();
      setSuggestions(data.items ?? []);
    } catch { setSuggestions([]); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  async function handleAISuggest(e: React.FormEvent) {
    e.preventDefault();
    if (!articleType || !targetService || !targetLocation) {
      setFormError('Makale türü, hizmet ve konum zorunludur.');
      return;
    }
    setGenerating(true); setFormError('');
    try {
      const res = await fetch('/admin/api/ai-content/suggest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleType, targetService, targetLocation, customerProfile: customerProfile || undefined,
          targetCountry: targetCountry || undefined, searchIntent: searchIntent || undefined,
          tone, wordCountTarget, competitorContext: competitorContext || undefined, targetLanguage,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setFormError(data.error || 'AI önerisi oluşturulamadı.'); return; }
      setShowForm(false); resetForm();
      fetchSuggestions();
    } catch { setFormError('Sunucu hatası oluştu.'); }
    finally  { setGenerating(false); }
  }

  function resetForm() {
    setArticleType(''); setTargetService(''); setTargetLocation('');
    setCustomerProfile(''); setTargetCountry(''); setSearchIntent('');
    setTone('Profesyonel'); setWordCountTarget(1500); setCompetitorContext('');
    setTargetLanguage('tr'); setFormError('');
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

  // Stats
  const total     = suggestions.length;
  const pending   = suggestions.filter(s => s.status === 'PENDING' || s.status === 'IN_PROGRESS').length;
  const complete  = suggestions.filter(s => s.status === 'COMPLETE').length;
  const freshness = suggestions.filter(s => s.timeSensitive && s.status === 'COMPLETE').length;

  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="AI İçerik Merkezi"
        description="Araştırma → Taslak → Onay iş akışı"
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href="/admin/ayarlar/icerik-entegrasyonlari" style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px', background: '#F3F6FA',
              color: '#52697A', fontSize: '12px', fontWeight: 600, border: '1px solid #D8E1E9',
              textDecoration: 'none',
            }}>Entegrasyonlar</Link>
            <button onClick={() => { setShowForm(v => !v); if (!showForm) setFormError(''); }} style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px', background: '#2563EB',
              color: '#FFFFFF', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer',
            }}>
              <Sparkles size={14} /> AI ile Oluştur
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <StatCard label="Toplam" value={total}    icon={<FileText size={18} />}      accent="#2563EB" />
        <StatCard label="Bekleyen" value={pending} icon={<Clock size={18} />}         accent="#D97706" />
        <StatCard label="Tamamlanan" value={complete} icon={<CheckCircle2 size={18} />} accent="#168C5B" />
        <StatCard label="Yenileme Gerekli" value={freshness} icon={<RefreshCw size={18} />} accent="#D64545" />
      </div>

      {/* Freshness alert */}
      {freshness > 0 && (
        <div style={{ display: 'flex', gap: '10px', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', background: '#FFF7ED', border: '1px solid #FED7AA' }}>
          <RefreshCw size={15} style={{ color: '#D97706', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#92400E', margin: 0 }}>
            <strong>{freshness} makale</strong> zaman duyarlı içerik içeriyor ve güncelleme gerektirebilir. Detay sayfasında &quot;Yeniden İncele&quot; etiketini kontrol edin.
          </p>
        </div>
      )}

      {/* AI suggest form */}
      {showForm && (
        <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(23,43,58,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <h3 style={{ color: '#172B3A', fontSize: '15px', fontFamily: 'Inter, sans-serif', fontWeight: 700, margin: '0 0 2px' }}>
                <Sparkles size={14} style={{ display: 'inline', marginRight: '6px', color: '#2563EB' }} />
                AI Konu + Anahtar Kelime Önerisi
              </h3>
              <p style={{ color: '#52697A', fontSize: '11px', fontFamily: 'Inter, sans-serif', margin: 0 }}>
                Search Console yakın kazanımları ve Google Ads yeni pazar fırsatları birlikte araştırılır; hiçbir metrik uydurulmaz.
              </p>
            </div>
            <button onClick={() => { setShowForm(false); resetForm(); }} style={{ background: 'none', border: 'none', color: '#718596', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>

          {formError && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px' }}>
              <p style={{ color: '#D64545', fontSize: '12px', fontFamily: 'Inter, sans-serif', margin: 0 }}>{formError}</p>
            </div>
          )}

          <form onSubmit={handleAISuggest} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Row 1 */}
            <div>
              <label style={labelStyle}>Makale Türü *</label>
              <select value={articleType} onChange={e => setArticleType(e.target.value)} required style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">Seçin...</option>
                {ARTICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Arama Amacı</label>
              <select value={searchIntent} onChange={e => setSearchIntent(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">Otomatik</option>
                {INTENTS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            {/* Row 2 */}
            <div>
              <label style={labelStyle}>Hedef Hizmet *</label>
              <input type="text" value={targetService} onChange={e => setTargetService(e.target.value)} required
                style={inputStyle} placeholder="VIP Transfer, Havalimanı Transfer..." />
            </div>
            <div>
              <label style={labelStyle}>Hedef Konum *</label>
              <input type="text" value={targetLocation} onChange={e => setTargetLocation(e.target.value)} required
                style={inputStyle} placeholder="İstanbul, Sabiha Gökçen, Sultanahmet..." />
            </div>

            {/* Row 3 */}
            <div>
              <label style={labelStyle}>Müşteri Profili</label>
              <input type="text" value={customerProfile} onChange={e => setCustomerProfile(e.target.value)}
                style={inputStyle} placeholder="İş seyahatçisi, turist, aile..." />
            </div>
            <div>
              <label style={labelStyle}>Hedef Ülke</label>
              <input type="text" value={targetCountry} onChange={e => setTargetCountry(e.target.value)}
                style={inputStyle} placeholder="Almanya, Rusya, İngiltere..." />
            </div>

            {/* Row 4 */}
            <div>
              <label style={labelStyle}>Ton</label>
              <select value={tone} onChange={e => setTone(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {TONES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Hedef Kelime Sayısı</label>
              <input type="number" value={wordCountTarget} onChange={e => setWordCountTarget(Number(e.target.value))}
                min={300} max={5000} style={inputStyle} />
            </div>

            {/* Row 5 */}
            <div>
              <label style={labelStyle}>İçerik Dili</label>
              <select value={targetLanguage} onChange={e => setTargetLanguage(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="tr">Türkçe (tr)</option>
                <option value="en">İngilizce (en)</option>
                <option value="de">Almanca (de)</option>
                <option value="ru">Rusça (ru)</option>
                <option value="ar">Arapça (ar)</option>
                <option value="fr">Fransızca (fr)</option>
                <option value="es">İspanyolca (es)</option>
                <option value="it">İtalyanca (it)</option>
                <option value="nl">Hollandaca (nl)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Rakip Bağlamı (opsiyonel)</label>
              <input type="text" value={competitorContext} onChange={e => setCompetitorContext(e.target.value)}
                style={inputStyle} placeholder="Rakip konular, açıklar..." />
            </div>

            {/* Actions */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button type="submit" disabled={generating} style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '9px 20px', borderRadius: '8px',
                background: generating ? '#93C5FD' : '#2563EB',
                color: '#FFFFFF', fontWeight: 600, fontSize: '13px',
                border: 'none', cursor: generating ? 'not-allowed' : 'pointer',
              }}>
                {generating ? (
                  <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> AI Düşünüyor...</>
                ) : (
                  <><Sparkles size={13} /> AI ile Konu Öner</>
                )}
              </button>
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
                style={{ padding: '9px 16px', borderRadius: '8px', background: '#FFFFFF', color: '#52697A', fontSize: '13px', border: '1px solid #D8E1E9', cursor: 'pointer' }}>
                İptal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Suggestions list */}
      {loading ? (
        <p style={{ color: '#718596', fontFamily: 'Inter, sans-serif', fontSize: '13px', textAlign: 'center', padding: '40px' }}>Yükleniyor...</p>
      ) : suggestions.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '1px dashed #D8E1E9', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <Sparkles size={28} style={{ color: '#C99A32', marginBottom: '14px' }} />
          <p style={{ color: '#172B3A', fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 600, margin: '0 0 6px' }}>İlk içerik önerinizi oluşturun</p>
          <p style={{ color: '#718596', fontFamily: 'Inter, sans-serif', fontSize: '13px', margin: 0 }}>
            AI İle Oluştur butonuna tıklayın — konu, anahtar kelime ve outline AI tarafından önerilecek.
          </p>
        </div>
      ) : (
        <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', overflow: 'hidden' }}>
          {suggestions.map((s, i) => {
            const sc = STATUS_COLORS[s.status] ?? { bg: '#F8FAFC', text: '#64748B' };
            const hasDraft = Boolean(s.contentDraft || s.draftBlogPostId);
            const hasCannibal = s.cannibalWarning && typeof s.cannibalWarning === 'object' && (s.cannibalWarning as { hasConflict?: boolean }).hasConflict;
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 16px',
                borderBottom: i < suggestions.length - 1 ? '1px solid #EDF2F7' : 'none',
                transition: 'background 0.15s',
              }}>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                    <p style={{ color: '#172B3A', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '360px' }}>
                      {s.suggestedTitle || '(başlıksız öneri)'}
                    </p>
                    {s.timeSensitive && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 7px', borderRadius: '4px', background: '#FFF7ED', color: '#D97706', fontSize: '10px', fontFamily: 'Inter, sans-serif', fontWeight: 700, flexShrink: 0 }}>
                        <RefreshCw size={9} /> Yenile
                      </span>
                    )}
                    {hasCannibal && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 7px', borderRadius: '4px', background: '#FEF2F2', color: '#D64545', fontSize: '10px', fontFamily: 'Inter, sans-serif', fontWeight: 700, flexShrink: 0 }}>
                        <AlertTriangle size={9} /> Kaniballeşme
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {s.primaryKeyword && (
                      <code style={{ fontSize: '10px', color: '#2563EB', background: '#EFF6FF', padding: '1px 6px', borderRadius: '4px' }}>{s.primaryKeyword}</code>
                    )}
                    {s.articleType && (
                      <span style={{ fontSize: '10px', color: '#52697A', fontFamily: 'Inter, sans-serif' }}>{s.articleType}</span>
                    )}
                    {hasDraft && (
                      <span style={{ fontSize: '10px', color: '#168C5B', fontFamily: 'Inter, sans-serif' }}>✓ Taslak var</span>
                    )}
                  </div>
                </div>

                {/* Status */}
                <span style={{ padding: '3px 9px', borderRadius: '5px', background: sc.bg, color: sc.text, fontSize: '10px', fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '0.06em', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {STATUS_LABELS[s.status] ?? s.status}
                </span>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <Link href={`/admin/ai-oneriler/${s.id}`} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px',
                    borderRadius: '6px', background: '#F3F6FA', color: '#2563EB',
                    fontSize: '11px', fontWeight: 600, textDecoration: 'none', border: '1px solid #D8E1E9',
                  }}>
                    Detay <ChevronRight size={11} />
                  </Link>
                  <button onClick={() => handleDelete(s.id)} disabled={deleting === s.id} title="Sil"
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '6px', background: '#FEF2F2', color: '#D64545', border: 'none', cursor: deleting === s.id ? 'not-allowed' : 'pointer', opacity: deleting === s.id ? 0.5 : 1 }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
