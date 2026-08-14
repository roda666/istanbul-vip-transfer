'use client';

/**
 * AI İçerik Önerisi Detay — full client component.
 * Panels: Öneri Bilgileri | Taslak Üretme | Kalite Skoru | Kaniballeşme | Sosyal Medya | Konu Kümesi | Çeviri Planı
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Sparkles, RefreshCw, CheckCircle2, AlertTriangle,
  FileText, Share2, Globe, LayoutGrid, ExternalLink, Copy, Check,
} from 'lucide-react';
import AdminPageHeader from '../../../_components/AdminPageHeader';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Suggestion {
  id: string;
  suggestedTitle: string | null;
  suggestedSlug: string | null;
  primaryKeyword: string | null;
  secondaryKeywords: string | null;
  searchIntent: string | null;
  suggestedOutline: string | null;
  aiSummary: string | null;
  contentDraft: string | null;
  draftError: string | null;
  articleType: string | null;
  targetService: string | null;
  targetLocation: string | null;
  customerProfile: string | null;
  targetCountry: string | null;
  targetLanguage: string;
  contentBrief: { tone?: string; wordCountTarget?: number; competitorContext?: string } | null;
  qualityScore: {
    intentAlignment: number; uniqueness: number; titleHierarchy: number;
    readability: number; metaLengths: number; altTextPresent: boolean;
    internalLinkCount: number; sourcesCoverage: number;
    forbiddenClaims: { found: boolean; examples: string[] };
    overallScore: number; suggestions?: string[];
  } | null;
  cannibalWarning: { hasConflict: boolean; conflictingPages: Array<{ slug: string; title: string; url: string }> } | null;
  topicClusterId: string | null;
  draftBlogPostId: string | null;
  timeSensitive: boolean;
  status: string;
  createdAt: string;
}

interface ResearchSource { id: string; title: string | null; url: string | null; claimSupported: string | null; sourceType: string; }
interface ClusterOption  { id: string; pillarTitle: string; pillarSlug: string; }

// ── Shared styles ──────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px',
  marginBottom: '16px', overflow: 'hidden',
};
const cardHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px',
  padding: '14px 20px', borderBottom: '1px solid #E8EDF2',
  background: '#F8FAFC',
};
const cardBody: React.CSSProperties = { padding: '20px' };
const labelSt: React.CSSProperties = {
  display: 'block', color: '#52697A', fontSize: '10px', fontFamily: 'Inter, sans-serif',
  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 700,
};
const valSt: React.CSSProperties = { color: '#172B3A', fontSize: '13px', fontFamily: 'Inter, sans-serif', margin: 0 };
const btn = (primary?: boolean, danger?: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
  fontFamily: 'Inter, sans-serif', border: danger ? '1px solid #FECACA' : primary ? 'none' : '1px solid #D8E1E9',
  background: danger ? '#FEF2F2' : primary ? '#2563EB' : '#F3F6FA',
  color: danger ? '#D64545' : primary ? '#FFFFFF' : '#172B3A', cursor: 'pointer',
});

function ScoreBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct   = Math.min(100, Math.round((value / max) * 100));
  const color = pct >= 75 ? '#168C5B' : pct >= 50 ? '#D97706' : '#D64545';
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '11px', color: '#52697A', fontFamily: 'Inter, sans-serif' }}>{label}</span>
        <span style={{ fontSize: '11px', color, fontFamily: 'Inter, sans-serif', fontWeight: 700 }}>{value}/{max}</span>
      </div>
      <div style={{ height: '4px', background: '#E8EDF2', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function doCopy() {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button onClick={doCopy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#718596', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', padding: '2px 4px' }}>
      {copied ? <Check size={12} style={{ color: '#168C5B' }} /> : <Copy size={12} />}
      {copied ? 'Kopyalandı' : 'Kopyala'}
    </button>
  );
}

// ── Main client component ──────────────────────────────────────────────────────

export default function AISuggestionDetail({
  suggestion: initial, researchSources: initialSources, availableClusters,
}: {
  suggestion: Suggestion;
  researchSources: ResearchSource[];
  availableClusters: ClusterOption[];
}) {
  const [sug, setSug]             = useState<Suggestion>(initial);
  const [sources]                 = useState<ResearchSource[]>(initialSources);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError]   = useState('');
  const [genResult, setGenResult] = useState<{ blogPostId?: string; blogSlug?: string; wordCount?: number } | null>(null);

  const [socialLoading, setSocialLoading]   = useState(false);
  const [socialDrafts, setSocialDrafts]     = useState<{ newsletterSummary: string; twitterDraft: string; linkedinDraft: string; instagramCaption: string } | null>(null);
  const [socialError, setSocialError]       = useState('');

  const [linkingCluster, setLinkingCluster] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState(sug.topicClusterId ?? '');

  // ── Generate article draft ────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!confirm('Taslak üretilecek. Bu işlem birkaç saniye sürebilir. Devam edilsin mi?')) return;
    setGenerating(true); setGenError(''); setGenResult(null);
    try {
      const res = await fetch('/admin/api/ai-content/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId: sug.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setGenError(data.error || 'Taslak üretilemedi.'); return; }
      setGenResult({ blogPostId: data.blogPostId, blogSlug: data.blogSlug, wordCount: data.draft?.wordCount });
      // Reload suggestion data
      const r2 = await fetch(`/admin/api/ai-suggestions/${sug.id}`);
      const d2 = await r2.json();
      if (d2.item) setSug(d2.item);
    } catch { setGenError('Sunucu hatası oluştu.'); }
    finally { setGenerating(false); }
  }

  // ── Generate social drafts ────────────────────────────────────────────────────

  async function handleSocial() {
    setSocialLoading(true); setSocialError('');
    try {
      const res = await fetch('/admin/api/ai-content/social', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId: sug.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSocialError(data.error || 'Sosyal medya taslakları üretilemedi.'); return; }
      setSocialDrafts(data.drafts);
    } catch { setSocialError('Sunucu hatası oluştu.'); }
    finally { setSocialLoading(false); }
  }

  // ── Link to cluster ───────────────────────────────────────────────────────────

  async function handleLinkCluster() {
    setLinkingCluster(true);
    try {
      const res = await fetch(`/admin/api/ai-suggestions/${sug.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicClusterId: selectedCluster || null }),
      });
      if (res.ok) setSug(prev => ({ ...prev, topicClusterId: selectedCluster || null }));
    } catch { /* ignore */ }
    finally { setLinkingCluster(false); }
  }

  const qScore = sug.qualityScore;
  const hasDraft = Boolean(sug.contentDraft || sug.draftBlogPostId);

  return (
    <div style={{ padding: '28px 24px', maxWidth: '860px' }}>
      {/* Back link */}
      <Link href="/admin/ai-oneriler" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#52697A', fontSize: '12px', fontFamily: 'Inter, sans-serif', textDecoration: 'none', marginBottom: '16px' }}>
        <ArrowLeft size={13} /> AI İçerik Önerileri
      </Link>

      <AdminPageHeader
        title={sug.suggestedTitle ?? 'AI Öneri Detayı'}
        description={`Durum: ${sug.status}${sug.timeSensitive ? ' · ⚡ Zaman Duyarlı' : ''}`}
        action={
          hasDraft && sug.draftBlogPostId ? (
            <Link href={`/admin/blog/${sug.draftBlogPostId}`} style={btn(true)}>
              <ExternalLink size={13} /> Blog Editöründe Aç
            </Link>
          ) : null
        }
      />

      {/* 1. Öneri Bilgileri */}
      <div style={card}>
        <div style={cardHeader}>
          <Sparkles size={15} style={{ color: '#C99A32' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#172B3A', fontFamily: 'Inter, sans-serif' }}>Öneri Bilgileri</span>
        </div>
        <div style={{ ...cardBody, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          {[
            { label: 'Makale Türü', val: sug.articleType },
            { label: 'Arama Amacı', val: sug.searchIntent },
            { label: 'Hedef Hizmet', val: sug.targetService },
            { label: 'Hedef Konum', val: sug.targetLocation },
            { label: 'Müşteri Profili', val: sug.customerProfile },
            { label: 'Hedef Ülke', val: sug.targetCountry },
            { label: 'Birincil Anahtar Kelime', val: sug.primaryKeyword },
            { label: 'Dil', val: sug.targetLanguage },
          ].map(({ label, val }) => (
            <div key={label}>
              <span style={labelSt}>{label}</span>
              <p style={valSt}>{val || '—'}</p>
            </div>
          ))}
          {sug.aiSummary && (
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={labelSt}>AI Özeti</span>
              <p style={{ ...valSt, fontSize: '12px', color: '#52697A', lineHeight: 1.6 }}>{sug.aiSummary}</p>
            </div>
          )}
          {sug.suggestedOutline && (
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={labelSt}>Önerilen Outline (H2)</span>
              <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '10px 14px' }}>
                {sug.suggestedOutline.split('\n').filter(Boolean).map((h, i) => (
                  <p key={i} style={{ color: '#2563EB', fontSize: '12px', fontFamily: 'Inter, sans-serif', margin: '3px 0' }}>H2: {h}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Taslak Üretme */}
      <div style={card}>
        <div style={cardHeader}>
          <FileText size={15} style={{ color: '#2563EB' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#172B3A', fontFamily: 'Inter, sans-serif' }}>Makale Taslağı</span>
          {hasDraft && <CheckCircle2 size={14} style={{ color: '#168C5B', marginLeft: 'auto' }} />}
        </div>
        <div style={cardBody}>
          {sug.draftError && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
              <p style={{ color: '#D64545', fontSize: '12px', fontFamily: 'Inter, sans-serif', margin: 0 }}>Son hata: {sug.draftError}</p>
            </div>
          )}
          {genError && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
              <p style={{ color: '#D64545', fontSize: '12px', fontFamily: 'Inter, sans-serif', margin: 0 }}>{genError}</p>
            </div>
          )}
          {genResult && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
              <p style={{ color: '#166534', fontSize: '12px', fontFamily: 'Inter, sans-serif', margin: '0 0 6px', fontWeight: 700 }}>✓ Taslak oluşturuldu!</p>
              <p style={{ color: '#166534', fontSize: '12px', fontFamily: 'Inter, sans-serif', margin: 0 }}>
                {genResult.wordCount} kelime · Slug: <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: '3px' }}>{genResult.blogSlug}</code>
                {' '}<Link href={`/admin/blog/${genResult.blogPostId}`} style={{ color: '#15803D' }}>Blog Editöründe Aç →</Link>
              </p>
            </div>
          )}
          {hasDraft ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#168C5B', fontFamily: 'Inter, sans-serif' }}>✓ Taslak oluşturuldu</span>
              {sug.draftBlogPostId && (
                <Link href={`/admin/blog/${sug.draftBlogPostId}`} style={btn(true)}>
                  <ExternalLink size={12} /> Blog Editöründe Aç
                </Link>
              )}
              <button onClick={handleGenerate} disabled={generating} style={btn()}>
                <RefreshCw size={12} /> Yeniden Üret
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleGenerate} disabled={generating} style={btn(true)}>
                {generating ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
                {generating ? 'Makale Üretiliyor...' : 'Makale Taslağı Üret'}
              </button>
              <p style={{ fontSize: '11px', color: '#718596', fontFamily: 'Inter, sans-serif', margin: 0 }}>
                Taslak DRAFT olarak Blog CMS&apos;e kaydedilir. Tek tıkla yayınlama yok.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Kalite Skoru */}
      {qScore && (
        <div style={card}>
          <div style={cardHeader}>
            <CheckCircle2 size={15} style={{ color: '#168C5B' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#172B3A', fontFamily: 'Inter, sans-serif' }}>Kalite Skoru</span>
            <span style={{ marginLeft: 'auto', fontSize: '16px', fontWeight: 800, color: qScore.overallScore >= 75 ? '#168C5B' : qScore.overallScore >= 50 ? '#D97706' : '#D64545', fontFamily: 'Inter, sans-serif' }}>
              {qScore.overallScore}/100
            </span>
          </div>
          <div style={cardBody}>
            <ScoreBar label="Arama Amacı Uyumu"    value={qScore.intentAlignment} />
            <ScoreBar label="Başlık Hiyerarşisi"   value={qScore.titleHierarchy} />
            <ScoreBar label="Okunabilirlik"         value={qScore.readability} />
            <ScoreBar label="Meta Uzunlukları"      value={qScore.metaLengths} />
            <ScoreBar label="Kaynak Kapsamı"        value={qScore.sourcesCoverage} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'Inter, sans-serif', color: '#52697A' }}>
                İç Bağlantı: <strong>{qScore.internalLinkCount}</strong>
              </span>
              <span style={{ fontSize: '11px', fontFamily: 'Inter, sans-serif', color: qScore.altTextPresent ? '#168C5B' : '#D64545' }}>
                {qScore.altTextPresent ? '✓ ALT metni' : '✗ ALT metni eksik'}
              </span>
            </div>
            {qScore.forbiddenClaims.found && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginTop: '12px' }}>
                <p style={{ color: '#D64545', fontSize: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 700, margin: '0 0 4px' }}>⚠ Yasak ifade tespit edildi</p>
                <p style={{ color: '#DC2626', fontSize: '11px', fontFamily: 'Inter, sans-serif', margin: 0 }}>{qScore.forbiddenClaims.examples.join(', ')}</p>
              </div>
            )}
            {qScore.suggestions && qScore.suggestions.length > 0 && (
              <div style={{ marginTop: '14px' }}>
                <p style={labelSt}>İyileştirme Önerileri</p>
                <ul style={{ paddingLeft: '16px', margin: 0 }}>
                  {qScore.suggestions.map((s, i) => (
                    <li key={i} style={{ color: '#52697A', fontSize: '11px', fontFamily: 'Inter, sans-serif', marginBottom: '4px' }}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Kaniballeşme Uyarısı */}
      {sug.cannibalWarning && (
        <div style={{ ...card, border: sug.cannibalWarning.hasConflict ? '1px solid #FECACA' : '1px solid #D8E1E9' }}>
          <div style={{ ...cardHeader, background: sug.cannibalWarning.hasConflict ? '#FEF2F2' : '#F8FAFC' }}>
            <AlertTriangle size={15} style={{ color: sug.cannibalWarning.hasConflict ? '#D64545' : '#718596' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#172B3A', fontFamily: 'Inter, sans-serif' }}>Kaniballeşme Kontrolü</span>
          </div>
          <div style={cardBody}>
            {sug.cannibalWarning.hasConflict ? (
              <>
                <p style={{ color: '#D64545', fontSize: '12px', fontFamily: 'Inter, sans-serif', margin: '0 0 12px', fontWeight: 700 }}>
                  ⚠ Birincil anahtar kelimeyle örtüşen {sug.cannibalWarning.conflictingPages.length} sayfa bulundu.
                </p>
                {sug.cannibalWarning.conflictingPages.map(p => (
                  <div key={p.slug} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 12px', background: '#FFF5F5', borderRadius: '8px', marginBottom: '6px' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif', color: '#172B3A', fontWeight: 600, margin: '0 0 2px' }}>{p.title}</p>
                      <code style={{ fontSize: '10px', color: '#718596' }}>{p.slug}</code>
                    </div>
                    <a href={p.url} target="_blank" rel="noreferrer" style={{ color: '#2563EB', flexShrink: 0 }}><ExternalLink size={12} /></a>
                  </div>
                ))}
              </>
            ) : (
              <p style={{ color: '#168C5B', fontSize: '12px', fontFamily: 'Inter, sans-serif', margin: 0 }}>
                ✓ Bu birincil anahtar kelimeyle örtüşen başka sayfa bulunamadı.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 5. Araştırma Kaynakları */}
      {sources.length > 0 && (
        <div style={card}>
          <div style={cardHeader}>
            <FileText size={15} style={{ color: '#52697A' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#172B3A', fontFamily: 'Inter, sans-serif' }}>Araştırma Kaynakları ({sources.length})</span>
          </div>
          <div style={cardBody}>
            {sources.map(src => (
              <div key={src.id} style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                  <p style={{ fontSize: '12px', color: '#172B3A', fontFamily: 'Inter, sans-serif', fontWeight: 600, margin: 0 }}>{src.title || '(başlıksız)'}</p>
                  {src.url && (
                    <a href={src.url} target="_blank" rel="noreferrer" style={{ color: '#2563EB', flexShrink: 0 }}><ExternalLink size={12} /></a>
                  )}
                </div>
                {src.claimSupported && (
                  <p style={{ fontSize: '11px', color: '#52697A', fontFamily: 'Inter, sans-serif', margin: 0 }}>{src.claimSupported}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Sosyal Medya Taslakları */}
      {hasDraft && (
        <div style={card}>
          <div style={cardHeader}>
            <Share2 size={15} style={{ color: '#2563EB' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#172B3A', fontFamily: 'Inter, sans-serif' }}>Sosyal Medya Taslakları</span>
            <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#52697A', fontFamily: 'Inter, sans-serif' }}>Sadece TASLAK — otomatik yayınlama yok</span>
          </div>
          <div style={cardBody}>
            {socialError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px', marginBottom: '12px' }}>
                <p style={{ color: '#D64545', fontSize: '12px', fontFamily: 'Inter, sans-serif', margin: 0 }}>{socialError}</p>
              </div>
            )}
            {!socialDrafts ? (
              <button onClick={handleSocial} disabled={socialLoading} style={btn(true)}>
                {socialLoading ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Share2 size={13} />}
                {socialLoading ? 'Oluşturuluyor...' : 'Sosyal Medya Taslakları Üret'}
              </button>
            ) : (
              <div style={{ display: 'grid', gap: '14px' }}>
                {([
                  { label: 'Bülten Özeti', key: 'newsletterSummary' },
                  { label: 'Twitter/X', key: 'twitterDraft' },
                  { label: 'LinkedIn', key: 'linkedinDraft' },
                  { label: 'Instagram', key: 'instagramCaption' },
                ] as const).map(({ label, key }) => (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={labelSt}>{label}</span>
                      <CopyButton text={socialDrafts[key]} />
                    </div>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E8EDF2', borderRadius: '8px', padding: '10px 14px' }}>
                      <p style={{ fontSize: '12px', color: '#172B3A', fontFamily: 'Inter, sans-serif', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{socialDrafts[key]}</p>
                    </div>
                  </div>
                ))}
                <button onClick={() => setSocialDrafts(null)} style={{ ...btn(), width: 'fit-content' }}>
                  <RefreshCw size={11} /> Yeniden Oluştur
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. Konu Kümesi */}
      <div style={card}>
        <div style={cardHeader}>
          <LayoutGrid size={15} style={{ color: '#52697A' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#172B3A', fontFamily: 'Inter, sans-serif' }}>Konu Kümesi</span>
          {sug.topicClusterId && <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#168C5B' }}>✓ Bağlandı</span>}
        </div>
        <div style={cardBody}>
          <label style={labelSt}>Konu Kümesine Bağla</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select value={selectedCluster} onChange={e => setSelectedCluster(e.target.value)}
              style={{ flex: 1, padding: '9px 12px', background: '#FFF', border: '1px solid #D8E1E9', borderRadius: '8px', color: '#172B3A', fontSize: '13px', fontFamily: 'Inter, sans-serif', outline: 'none' }}>
              <option value="">— Küme seçin —</option>
              {availableClusters.map(c => (
                <option key={c.id} value={c.id}>{c.pillarTitle} (/{c.pillarSlug})</option>
              ))}
            </select>
            <button onClick={handleLinkCluster} disabled={linkingCluster} style={btn(true)}>
              {linkingCluster ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              Kaydet
            </button>
          </div>
          <p style={{ fontSize: '11px', color: '#718596', fontFamily: 'Inter, sans-serif', margin: '8px 0 0' }}>
            Yeni küme oluşturmak için <Link href="/admin/ai-oneriler/kumeler" style={{ color: '#2563EB' }}>Konu Kümeleri</Link> sayfasına gidin.
          </p>
        </div>
      </div>

      {/* 8. Çeviri Planı */}
      {hasDraft && sug.draftBlogPostId && (
        <div style={card}>
          <div style={cardHeader}>
            <Globe size={15} style={{ color: '#52697A' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#172B3A', fontFamily: 'Inter, sans-serif' }}>Çeviri Planı</span>
          </div>
          <div style={cardBody}>
            <p style={{ fontSize: '12px', color: '#52697A', fontFamily: 'Inter, sans-serif', margin: '0 0 12px' }}>
              Makale Blog Editöründe onaylandıktan sonra, Dil ve Çeviri panelinden çeviri kuyruğuna ekleyebilirsiniz.
            </p>
            <Link href={`/admin/blog/${sug.draftBlogPostId}`} style={btn(true)}>
              <ExternalLink size={12} /> Blog Editöründe Çeviriyi Yönet
            </Link>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
