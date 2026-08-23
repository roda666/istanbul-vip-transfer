'use client';

/**
 * /admin/ai-studio/[id] — Proje Akış Sayfası
 *
 * Tam 10-aşamalı editoryal akış:
 * Kurulum → Araştırma → Taslak → SEO → Görsel → Çeviriler →
 * İnceleme → Onay → Zamanlama → Yayın
 */

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  RefreshCw, Sparkles, CheckCircle2, AlertTriangle,
  Send, Globe, ImageIcon, Calendar, FileText,
  Download, ExternalLink, Loader2,
} from 'lucide-react';
import AdminPageHeader from '../../../_components/AdminPageHeader';
import type { StudioProject, StudioTranslation, StudioImage, ResearchSource, DistributionDraft, StudioAuditEntry } from '@/lib/studio/types';
import { STAGE_LABELS, STAGE_ORDER, STATUS_LABELS, LANG_LABELS, TARGET_LANGS } from '@/lib/studio/types';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#F3F6FA', card: '#FFFFFF', border: '#D8E1E9',
  navy: '#132A44', gold: '#C99A32', text: '#172B3A',
  muted: '#52697A', light: '#718596',
};
const input: React.CSSProperties = { width: '100%', padding: '9px 12px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, fontSize: '13px', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' };
const label: React.CSSProperties = { display: 'block', fontFamily: 'Inter, sans-serif', fontSize: '11px', color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 };
const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '20px 24px' };
const btn = (variant: 'primary' | 'secondary' | 'danger' | 'ghost' = 'secondary'): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
  fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600,
  background: variant === 'primary' ? C.gold : variant === 'danger' ? '#DC2626' : variant === 'ghost' ? 'transparent' : C.card,
  color: variant === 'primary' || variant === 'danger' ? '#fff' : variant === 'ghost' ? C.muted : C.text,
  boxShadow: variant === 'ghost' ? 'none' : `0 0 0 1px ${variant === 'danger' ? '#DC2626' : C.border}`,
});

// ── Trans status colors ────────────────────────────────────────────────────────
const TRANS_COLORS: Record<string, { bg: string; text: string }> = {
  pending:    { bg: '#F3F4F6', text: '#6B7280' },
  generating: { bg: '#EFF6FF', text: '#2563EB' },
  draft:      { bg: '#FFFBEB', text: '#D97706' },
  approved:   { bg: '#F0FDF4', text: '#168C5B' },
  published:  { bg: '#ECFDF5', text: '#059669' },
};

// ── Stage tracker ─────────────────────────────────────────────────────────────
function StageTracker({ currentStage, onSelect }: { currentStage: string; onSelect: (s: string) => void }) {
  const visibleStages = STAGE_ORDER.filter(s => !['archived'].includes(s));
  const currentIdx = visibleStages.indexOf(currentStage as never);

  return (
    <div style={{ overflowX: 'auto', padding: '0 0 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', minWidth: 'max-content' }}>
        {visibleStages.map((stage, idx) => {
          const isCurrent = stage === currentStage;
          const isDone    = idx < currentIdx;
          return (
            <div key={stage} style={{ display: 'flex', alignItems: 'center' }}>
              <button onClick={() => onSelect(stage)} style={{
                padding: '6px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: isCurrent ? 700 : 500,
                background: isCurrent ? C.navy : isDone ? '#ECFDF5' : '#F3F6FA',
                color:      isCurrent ? '#fff'  : isDone ? '#059669' : C.muted,
                transition: 'all 0.15s', whiteSpace: 'nowrap',
                boxShadow: isCurrent ? `0 0 0 2px ${C.gold}` : 'none',
              }}>
                {isDone ? '✓ ' : ''}{STAGE_LABELS[stage]}
              </button>
              {idx < visibleStages.length - 1 && (
                <div style={{ width: '20px', height: '1px', background: idx < currentIdx ? C.gold : C.border, flexShrink: 0 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────────
function Alert({ type, children }: { type: 'info' | 'warn' | 'error' | 'success'; children: React.ReactNode }) {
  const colors = {
    info:    { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },
    warn:    { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E' },
    error:   { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626' },
    success: { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534' },
  }[type];
  return (
    <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '10px 14px', fontFamily: 'Inter, sans-serif', fontSize: '12px', color: colors.text }}>
      {children}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spin() {
  return <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />;
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface FullProject extends StudioProject {
  translations: StudioTranslation[];
  images: StudioImage[];
  research: ResearchSource[];
  distribution: DistributionDraft[];
  recentAudit: StudioAuditEntry[];
}

export default function StudioProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router  = useRouter();
  const [project, setProject]     = useState<FullProject | null>(null);
  const [loading, setLoading]     = useState(true);
  const [activeStage, setActiveStage] = useState<string>('setup');
  const [working, setWorking]     = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  // Draft edit state
  const [editingDraft, setEditingDraft] = useState(false);
  const [draftText, setDraftText]       = useState('');

  // Translation selections
  const [selectedLangs, setSelectedLangs] = useState<string[]>([...TARGET_LANGS]);
  const [publishLangs, setPublishLangs]   = useState<string[]>([]);

  // Schedule
  const [scheduleDate, setScheduleDate]  = useState('');
  const [scheduleLangs, setScheduleLangs] = useState<string[]>([]);

  // Image approve/reject — per-image rejection reasons
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/admin/api/studio/projects/${id}`);
      if (!res.ok) { router.push('/admin/ai-studio'); return; }
      const { project } = await res.json() as { project: FullProject };
      setProject(project);
      setActiveStage(project.stage);
      if (project.trContent) setDraftText((project.trContent as { bodyMd?: string }).bodyMd ?? '');
      // Pre-select approved translations for publish
      setPublishLangs(
        project.translations.filter(t => t.status === 'approved').map(t => t.lang)
      );
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { void load(); }, [load]);

  function flash(msg: string, type: 'ok' | 'err') {
    if (type === 'ok') { setSuccess(msg); setError(''); }
    else               { setError(msg);   setSuccess(''); }
    setTimeout(() => { setSuccess(''); setError(''); }, 6000);
  }

  async function api(path: string, method = 'POST', body?: unknown) {
    const res = await fetch(`/admin/api/studio/projects/${id}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new Error((data.error as string) ?? 'İşlem başarısız.');
    return data;
  }

  async function run(fn: () => Promise<unknown>, successMsg: string) {
    setWorking(true); setError(''); setSuccess('');
    try { await fn(); flash(successMsg, 'ok'); await load(); }
    catch (e) { flash(e instanceof Error ? e.message : 'Hata.', 'err'); }
    finally { setWorking(false); }
  }

  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', fontFamily: 'Inter, sans-serif', color: C.muted }}>
          <Spin /> <p>Yükleniyor…</p>
        </div>
      </div>
    );
  }

  if (!project) return null;
  // Narrowed non-null binding — inner closures (panel components) use `p` so TypeScript
  // doesn't complain that the state variable might be null when a panel is called later.
  const p = project;

  const trContent = p.trContent as Record<string, unknown> | null;
  const config    = p.config as Record<string, unknown>;
  const approvedImage = p.images.find(img => img.status === 'approved');
  const pendingImages = p.images.filter(img => img.status === 'pending_approval');

  // ── Stage panels ─────────────────────────────────────────────────────────────

  function SetupPanel() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={card}>
          <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Proje Yapılandırması</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {[
              ['İçerik Türü', p.contentType === 'blog' ? 'Blog Yazısı' : 'Hizmet Sayfası'],
              ['Hizmet Türü', String(config.serviceType ?? '-')],
              ['Arama Niyeti', String(config.searchIntent ?? '-')],
              ['Şehir / Rota', String(config.cityOrRoute ?? '-')],
              ['Hedef Kitle', String(config.audience ?? '-')],
              ['Ton', String(config.tone ?? '-')],
              ['Kelime Hedefi', String(config.wordCountTarget ?? 1200)],
              ['Makale Türü', String(config.articleType ?? '-')],
            ].map(([k, v]) => (
              <div key={k}>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 3px', fontWeight: 600 }}>{k}</p>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: C.text, margin: 0 }}>{v}</p>
              </div>
            ))}
          </div>

          {/* Keywords */}
          {Array.isArray(config.keywords) && (config.keywords as string[]).length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, margin: '0 0 6px' }}>
                Anahtar Kelimeler <span style={{ color: '#7C3AED', background: '#F5F3FF', padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>Manuel</span>
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(config.keywords as string[]).map((kw, i) => (
                  <span key={i} style={{ background: '#EFF6FF', color: '#2563EB', fontSize: '12px', fontFamily: 'Inter, sans-serif', padding: '3px 9px', borderRadius: '6px' }}>{kw}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <Alert type="info">
          <strong>Başlamak için:</strong> &quot;Araştırma Yap&quot; butonuna tıklayın. AI, konu araştırması yapacak ve içerik özeti oluşturacak.
          Anahtar kelime verisi yok — AI tahmini kullanılacak.
        </Alert>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button style={btn('primary')} disabled={working}
            onClick={() => run(() => api('/research').then(() => setActiveStage('research')), 'Araştırma tamamlandı!')}
          >
            {working ? <Spin /> : <Sparkles size={16} />} Araştırma Yap
          </button>
        </div>
      </div>
    );
  }

  function ResearchPanel() {
    const research = p.research;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {research.length === 0 ? (
          <Alert type="warn">Araştırma kaynağı yok. Kurulum aşamasından araştırmayı başlatın.</Alert>
        ) : (
          <div style={card}>
            <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 700, color: C.text, margin: '0 0 16px' }}>
              Araştırma Kaynakları ({research.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {research.map(src => (
                <div key={src.id} style={{ background: '#F8FAFC', borderRadius: '8px', padding: '12px 14px', border: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', fontFamily: 'Inter, sans-serif', background: '#F3F4F6', color: C.muted, padding: '2px 7px', borderRadius: '4px', fontWeight: 600 }}>
                      {src.sourceType === 'ai_context' ? 'AI Bağlamı' : 'Manuel'}
                    </span>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, color: C.text }}>{src.title ?? 'Genel Bilgi'}</span>
                    {src.url && <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', color: C.gold }}><ExternalLink size={12} /></a>}
                  </div>
                  {src.claims.map((claim, i) => (
                    <p key={i} style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: C.muted, margin: '2px 0 0', paddingLeft: '8px', borderLeft: `2px solid ${C.border}` }}>{claim}</p>
                  ))}
                  {src.accessedAt && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: C.light, margin: '4px 0 0' }}>Erişim: {new Date(src.accessedAt).toLocaleDateString('tr-TR')}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button style={btn()} disabled={working}
            onClick={() => run(() => api('/research').then(() => setActiveStage('research')), 'Araştırma yenilendi!')}
          >
            {working ? <Spin /> : <RefreshCw size={15} />} Yeniden Araştır
          </button>
          <button style={btn('primary')} disabled={working}
            onClick={() => run(() => api('/draft').then(() => setActiveStage('draft')), 'Türkçe taslak oluşturuldu!')}
          >
            {working ? <Spin /> : <FileText size={16} />} Türkçe Taslak Üret
          </button>
        </div>
      </div>
    );
  }

  function DraftPanel() {
    const trC = trContent;
    if (!trC) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Alert type="warn">Türkçe taslak henüz oluşturulmamış.</Alert>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button style={btn('primary')} disabled={working}
            onClick={() => run(() => api('/draft').then(() => setActiveStage('draft')), 'Türkçe taslak oluşturuldu!')}
          >
            {working ? <Spin /> : <Sparkles size={16} />} Taslak Oluştur
          </button>
        </div>
      </div>
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* SEO meta summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {[
            { l: 'Başlık', v: String(trC.title ?? '') },
            { l: 'Slug', v: String(trC.slug ?? '') },
            { l: 'Meta Başlık', v: `${String(trC.metaTitle ?? '')} (${String(trC.metaTitle ?? '').length} kar.)` },
            { l: 'Kelime Sayısı', v: String(trC.wordCount ?? 0) },
          ].map(({ l: lbl, v }) => (
            <div key={lbl} style={{ background: '#F8FAFC', borderRadius: '8px', padding: '10px 14px', border: `1px solid ${C.border}` }}>
              <p style={{ ...label, margin: '0 0 3px' }}>{lbl}</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: C.text, margin: 0, wordBreak: 'break-word' }}>{v}</p>
            </div>
          ))}
        </div>

        {/* Body editor */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: 0 }}>İçerik Gövdesi (Markdown)</h3>
            <button style={btn(editingDraft ? 'primary' : 'secondary')} onClick={() => setEditingDraft(e => !e)}>
              {editingDraft ? 'Görüntüle' : 'Düzenle'}
            </button>
          </div>
          {editingDraft ? (
            <textarea
              value={draftText}
              onChange={e => setDraftText(e.target.value)}
              style={{ ...input, minHeight: '400px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
            />
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {String(trC.bodyMd ?? '')}
            </div>
          )}
        </div>

        {/* FAQs */}
        {Array.isArray(trC.faqs) && (trC.faqs as Array<{ question: string; answer: string }>).length > 0 && (
          <div style={card}>
            <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 12px' }}>SSS ({(trC.faqs as []).length})</h3>
            {(trC.faqs as Array<{ question: string; answer: string }>).map((faq, i) => (
              <div key={i} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: i < (trC.faqs as []).length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, color: C.text, margin: '0 0 4px' }}>{faq.question}</p>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: C.muted, margin: 0 }}>{faq.answer}</p>
              </div>
            ))}
          </div>
        )}

        {p.trApprovedAt && (
          <Alert type="success">✓ Türkçe taslak onaylandı — {new Date(p.trApprovedAt).toLocaleString('tr-TR')}</Alert>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {editingDraft && (
            <button style={btn()} disabled={working} onClick={() => run(async () => {
              const updated = { ...(trContent as object), bodyMd: draftText };
              await api('', 'PATCH', { trContent: updated });
              setEditingDraft(false);
            }, 'Taslak kaydedildi. (Onay sıfırlandı)')}>
              {working ? <Spin /> : null} Kaydet
            </button>
          )}
          <button style={btn()} disabled={working}
            onClick={() => run(() => api('/seo').then(() => setActiveStage('seo_check')), 'SEO kontrolü tamamlandı!')}>
            {working ? <Spin /> : null} SEO Kontrol
          </button>
          {!p.trApprovedAt ? (
            <button style={btn('primary')} disabled={working}
              onClick={() => run(() => api('/approve', 'POST', { action: 'approve' }), 'Türkçe taslak onaylandı!')}>
              {working ? <Spin /> : <CheckCircle2 size={16} />} Taslağı Onayla
            </button>
          ) : (
            <button style={btn()} disabled={working}
              onClick={() => run(() => api('/approve', 'POST', { action: 'reject' }), 'Onay geri alındı.')}>
              Onayı Geri Al
            </button>
          )}
        </div>
      </div>
    );
  }

  function SeoPanel() {
    const score = p.seoScore as Record<string, unknown> | null;
    const canni = p.cannibalization as { hasConflict: boolean; conflictingPages: Array<{ slug: string; title: string }> } | null;

    if (!score) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Alert type="warn">SEO analizi henüz çalıştırılmamış.</Alert>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button style={btn('primary')} disabled={working}
            onClick={() => run(() => api('/seo').then(() => setActiveStage('seo_check')), 'SEO analizi tamamlandı!')}>
            {working ? <Spin /> : <Sparkles size={16} />} SEO Analizi Çalıştır
          </button>
        </div>
      </div>
    );

    const overall = Number(score.overallScore ?? 0);
    const scoreColor = overall >= 80 ? '#059669' : overall >= 60 ? '#D97706' : '#DC2626';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Overall score */}
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: scoreColor + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '24px', fontWeight: 700, color: scoreColor }}>{overall}</span>
          </div>
          <div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '18px', fontWeight: 700, color: C.text, margin: '0 0 4px' }}>SEO Skoru</p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: overall >= 80 ? '#059669' : overall >= 60 ? '#D97706' : '#DC2626', margin: 0, fontWeight: 600 }}>
              {overall >= 80 ? 'İyi' : overall >= 60 ? 'Geliştirilebilir' : 'Dikkat Gerekli'}
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', flex: 1 }}>
            {[
              ['Niyet Uyumu', Number(score.intentAlignment ?? 0)],
              ['Başlık Hiyerarsisi', Number(score.titleHierarchy ?? 0)],
              ['Okunabilirlik', Number(score.readability ?? 0)],
              ['Meta Uzunlukları', Number(score.metaLengths ?? 0)],
              ['Kaynak Kapsama', Number(score.sourcesCoverage ?? 0)],
            ].map(([name, val]) => (
              <div key={String(name)} style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '18px', fontWeight: 700, color: Number(val) >= 70 ? '#059669' : '#D97706', margin: '0 0 2px' }}>{val}</p>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: C.muted, margin: 0, lineHeight: 1.3 }}>{String(name)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Suggestions */}
        {Array.isArray(score.suggestions) && (score.suggestions as string[]).length > 0 && (
          <div style={card}>
            <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 12px' }}>Öneriler</h3>
            {(score.suggestions as string[]).map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                <AlertTriangle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: C.text, margin: 0 }}>{s}</p>
              </div>
            ))}
          </div>
        )}

        {/* Cannibalization */}
        {canni && canni.hasConflict && (
          <Alert type="error">
            ⚠️ <strong>Cannibalization uyarısı:</strong> Bu slug veya benzeri sayfalar zaten mevcut:{' '}
            {canni.conflictingPages.map(p => p.slug).join(', ')}
          </Alert>
        )}
        {canni && !canni.hasConflict && <Alert type="success">✓ Slug çakışması yok.</Alert>}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button style={btn()} disabled={working}
            onClick={() => run(() => api('/seo').then(() => setActiveStage('seo_check')), 'SEO yenilendi!')}>
            {working ? <Spin /> : <RefreshCw size={15} />} Yenile
          </button>
          <button style={btn('primary')} onClick={() => setActiveStage('visual')}>
            Görsel Aşamasına Geç →
          </button>
        </div>
      </div>
    );
  }

  function VisualPanel() {
    const [uploading, setUploading] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);

    async function handleGenerate() {
      await run(async () => {
        const data = await api('/image');
        if (data.fallback) throw new Error(String(data.error));
      }, 'Görsel üretildi!');
    }

    async function handleUpload() {
      if (!uploadFile) return;
      setUploading(true);
      try {
        const signRes = await fetch('/admin/api/storage/request-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: uploadFile.name, size: uploadFile.size, contentType: uploadFile.type, namespace: `studio/${id}` }),
        });
        const { uploadURL, serveUrl } = await signRes.json() as { uploadURL: string; serveUrl: string };
        await fetch(uploadURL, { method: 'PUT', body: uploadFile, headers: { 'Content-Type': uploadFile.type } });
        await api('/image', 'POST', { url: serveUrl, altText: uploadFile.name });
        flash('Görsel yüklendi!', 'ok');
        await load();
      } catch (e) {
        flash(e instanceof Error ? e.message : 'Yükleme hatası.', 'err');
      } finally {
        setUploading(false);
      }
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <Alert type="info">
          <strong>Görsel Politikası:</strong> Gerçek kişi, plaka, marka logosu veya yanıltıcı müşteri görseli üretilmez.
          AI üretimi için DALL-E 3 kullanılır. Yükleme seçeneğiyle kendi görselinizi ekleyebilirsiniz.
        </Alert>

        {/* Approved cover */}
        {approvedImage && (
          <div style={card}>
            <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 700, color: '#059669', margin: '0 0 12px' }}>✓ Onaylı Kapak Görseli</h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {approvedImage.url && <img src={approvedImage.url} alt={approvedImage.altText ?? ''} style={{ width: '100%', maxHeight: '250px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' }} />}
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: C.muted, margin: '0 0 4px' }}>Alt: {approvedImage.altText}</p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: C.light, margin: 0 }}>Kullanım: {approvedImage.usageRights}</p>
          </div>
        )}

        {/* Pending images */}
        {pendingImages.length > 0 && (
          <div style={card}>
            <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 12px' }}>
              Onay Bekleyen Görseller ({pendingImages.length})
            </h3>
            {pendingImages.map(img => (
              <div key={img.id} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: `1px solid ${C.border}` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {img.url && <img src={img.url} alt="" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }} />}
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: C.muted, margin: '0 0 8px' }}>{img.prompt?.slice(0, 120)}…</p>
                <textarea
                  placeholder="Red sebebi (isteğe bağlı)…"
                  value={rejectReasons[img.id] ?? ''}
                  onChange={e => setRejectReasons(prev => ({ ...prev, [img.id]: e.target.value }))}
                  rows={2}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '12px', fontFamily: 'Inter, sans-serif', border: `1px solid ${C.border}`, borderRadius: '7px', color: C.text, resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: '8px' }}
                />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button style={btn('primary')} disabled={working}
                    onClick={() => run(() => api('/image', 'PATCH', { imageId: img.id, action: 'approve', altText: img.altText }), 'Görsel onaylandı!')}>
                    {working ? <Spin /> : <CheckCircle2 size={15} />} Onayla
                  </button>
                  <button style={btn('danger')} disabled={working}
                    onClick={() => {
                      const reason = rejectReasons[img.id]?.trim() || 'Görsel reddedildi.';
                      run(() => api('/image', 'PATCH', { imageId: img.id, action: 'reject', rejectionReason: reason }), 'Görsel reddedildi.');
                    }}>
                    Reddet
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={card}>
          <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Görsel Ekle</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <button style={btn('primary')} disabled={working}
              onClick={handleGenerate}>
              {working ? <Spin /> : <Sparkles size={16} />} AI Görsel Üret (DALL-E 3)
            </button>
          </div>
          <div style={{ background: '#F8FAFC', border: `2px dashed ${C.border}`, borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
            <ImageIcon size={24} color={C.border} style={{ display: 'block', margin: '0 auto 8px' }} />
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: C.muted, margin: '0 0 10px' }}>Kendi görselinizi yükleyin (JPG, PNG, WebP — maks. 10MB)</p>
            <input type="file" accept="image/*" onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
              style={{ display: 'block', margin: '0 auto 10px', fontFamily: 'Inter, sans-serif', fontSize: '12px' }} />
            {uploadFile && (
              <button style={btn('primary')} disabled={uploading} onClick={handleUpload}>
                {uploading ? <Spin /> : null} Yükle: {uploadFile.name}
              </button>
            )}
          </div>
        </div>

        {approvedImage && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button style={btn('primary')} onClick={() => setActiveStage('translations')}>
              Çevirilere Geç →
            </button>
          </div>
        )}
      </div>
    );
  }

  function TranslationsPanel() {
    const translations = p.translations;
    const canStart = !!p.trApprovedAt;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {!canStart && (
          <Alert type="error">
            ⛔ Çeviri başlatmak için önce Türkçe taslağı onaylamanız gerekiyor. (Taslak → Onayla)
          </Alert>
        )}

        {canStart && (
          <Alert type="info">
            <strong>Kaynak dil: Türkçe (onaylı)</strong> — 8 hedef dil için AI çevirisi başlatılabilir.
            Çeviriler yalnızca TASLAK olarak oluşturulur; her dil ayrı onay gerektirir.
          </Alert>
        )}

        {/* Lang selection */}
        <div style={card}>
          <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 14px' }}>Çevirilecek Diller</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
            {TARGET_LANGS.map(lang => {
              const selected = selectedLangs.includes(lang);
              const trans = translations.find(t => t.lang === lang);
              const tColor = TRANS_COLORS[trans?.status ?? 'pending'];
              return (
                <button key={lang} onClick={() => setSelectedLangs(prev => selected ? prev.filter(l => l !== lang) : [...prev, lang])}
                  disabled={!canStart}
                  style={{
                    padding: '7px 14px', borderRadius: '8px', border: `2px solid ${selected ? C.gold : C.border}`,
                    background: selected ? '#FFFBEB' : C.card, cursor: canStart ? 'pointer' : 'not-allowed',
                    fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                  <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{lang}</span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: C.light }}>{LANG_LABELS[lang]}</span>
                  {trans && (
                    <span style={{ fontSize: '10px', background: tColor.bg, color: tColor.text, padding: '1px 5px', borderRadius: '4px' }}>
                      {trans.status === 'pending' ? 'Bekliyor' : trans.status === 'generating' ? 'Üretiliyor' : trans.status === 'draft' ? 'Taslak' : trans.status === 'approved' ? 'Onaylı' : 'Yayında'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button style={btn('primary')} disabled={!canStart || working || selectedLangs.length === 0}
            onClick={() => run(() => api('/translations', 'POST', { langs: selectedLangs }), `${selectedLangs.length} dil için çeviri başlatıldı!`)}>
            {working ? <Spin /> : <Globe size={16} />} Seçili Dilleri Çevir ({selectedLangs.length})
          </button>
        </div>

        {/* Translation status grid */}
        {translations.length > 0 && (
          <div style={card}>
            <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 14px' }}>Çeviri Durumu</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {translations.map(trans => {
                const tColor = TRANS_COLORS[trans.status];
                return (
                  <div key={trans.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#F8FAFC', borderRadius: '8px', border: `1px solid ${C.border}` }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', fontFamily: 'Inter, sans-serif', color: C.text, minWidth: '28px' }}>{trans.lang.toUpperCase()}</span>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: C.muted, flex: 1 }}>{LANG_LABELS[trans.lang]}</span>
                    <span style={{ fontSize: '11px', fontFamily: 'Inter, sans-serif', background: tColor.bg, color: tColor.text, padding: '3px 8px', borderRadius: '5px', fontWeight: 600 }}>
                      {trans.status === 'pending' ? 'Bekliyor' : trans.status === 'generating' ? 'Üretiliyor' : trans.status === 'draft' ? 'Taslak' : trans.status === 'approved' ? 'Onaylı' : 'Yayında'}
                    </span>
                    {trans.status === 'draft' && (
                      <button style={btn('primary')} disabled={working}
                        onClick={() => run(() => api(`/translations/${trans.lang}`, 'PATCH', { action: 'approve' }), `${trans.lang.toUpperCase()} onaylandı!`)}>
                        {working ? <Spin /> : <CheckCircle2 size={14} />} Onayla
                      </button>
                    )}
                    {trans.status === 'approved' && (
                      <button style={btn('ghost')} disabled={working}
                        onClick={() => run(() => api(`/translations/${trans.lang}`, 'PATCH', { action: 'reject' }), `${trans.lang.toUpperCase()} onayı kaldırıldı.`)}>
                        Geri Al
                      </button>
                    )}
                    {trans.aiModel && <span style={{ fontSize: '10px', color: C.light, fontFamily: 'Inter, sans-serif' }}>{trans.aiModel}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  function ReviewPanel() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={card}>
          <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 700, color: C.text, margin: '0 0 16px' }}>İçerik Özeti</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            {[
              { l: 'Başlık', v: String(trContent?.title ?? '-') },
              { l: 'Slug', v: String(trContent?.slug ?? '-') },
              { l: 'Meta Başlık', v: `${String(trContent?.metaTitle ?? '-')} (${String(trContent?.metaTitle ?? '').length} kar.)` },
              { l: 'Meta Açıklama', v: `${String(trContent?.metaDescription ?? '-').slice(0, 80)}… (${String(trContent?.metaDescription ?? '').length} kar.)` },
              { l: 'Kelime Sayısı', v: String(trContent?.wordCount ?? 0) },
              { l: 'SSS', v: `${Array.isArray(trContent?.faqs) ? (trContent.faqs as []).length : 0} madde` },
              { l: 'Dahili Bağlantı', v: `${Array.isArray(trContent?.internalLinks) ? (trContent.internalLinks as []).length : 0} öneri` },
              { l: 'Türkçe Onay', v: p.trApprovedAt ? '✓ Onaylı' : '✗ Onaylanmamış' },
              { l: 'CMS Kaydı', v: p.cmsEntityId ? `DRAFT (${p.cmsEntityId.slice(0, 8)}…)` : 'Aktarılmadı' },
              { l: 'Görsel', v: approvedImage ? '✓ Onaylı' : 'Yok' },
            ].map(({ l: lbl, v }) => (
              <div key={lbl} style={{ background: '#F8FAFC', borderRadius: '8px', padding: '10px 14px', border: `1px solid ${C.border}` }}>
                <p style={{ ...label, margin: '0 0 3px' }}>{lbl}</p>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: C.text, margin: 0, wordBreak: 'break-word' }}>{v}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 12px' }}>Çeviriler</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {TARGET_LANGS.map(lang => {
              const trans = p.translations.find(t => t.lang === lang);
              const tColor = TRANS_COLORS[trans?.status ?? 'pending'];
              return (
                <span key={lang} style={{ display: 'inline-flex', gap: '4px', alignItems: 'center', padding: '4px 10px', borderRadius: '6px', background: tColor.bg, fontSize: '12px', fontFamily: 'Inter, sans-serif', color: tColor.text, fontWeight: 600 }}>
                  {lang.toUpperCase()} {trans?.status === 'approved' ? '✓' : trans?.status === 'draft' ? '~' : '–'}
                </span>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {!p.cmsEntityId && p.trApprovedAt && (
            <button style={btn('primary')} disabled={working}
              onClick={() => run(() => api('/export'), "CMS'e aktarıldı!")}>
              {working ? <Spin /> : <Download size={16} />} CMS&apos;e TASLAK Aktar
            </button>
          )}
          {p.cmsEntityId && (
            <Link href={`/admin/${p.contentType === 'blog' ? 'blog' : 'hizmetler'}/${p.cmsEntityId}`} target="_blank">
              <button style={btn()}>
                <ExternalLink size={15} /> CMS&apos;de Görüntüle
              </button>
            </Link>
          )}
          <button style={btn('primary')} onClick={() => setActiveStage('approval')}>
            Onay Aşamasına Geç →
          </button>
        </div>
      </div>
    );
  }

  function ApprovalPanel() {
    const [notes, setNotes] = useState('');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {p.trApprovedAt ? (
          <Alert type="success">
            ✓ Türkçe taslak onaylandı — {new Date(p.trApprovedAt).toLocaleString('tr-TR')}
          </Alert>
        ) : (
          <Alert type="warn">Türkçe taslak henüz onaylanmamış.</Alert>
        )}

        <div style={card}>
          <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 12px' }}>İnsan Onayı</h3>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: C.muted, margin: '0 0 14px' }}>
            Yayınlamadan önce içeriği inceleyip onaylayın. <strong>Hepsini otomatik yayınla</strong> özelliği yoktur.
            Her dil ayrı ayrı onaylanmalıdır.
          </p>
          <textarea
            style={{ ...input, resize: 'vertical', minHeight: '80px', marginBottom: '14px' }}
            placeholder="Onay notu (opsiyonel)…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button style={btn('primary')} disabled={working}
              onClick={() => run(() => api('/approve', 'POST', { action: 'approve', notes }), 'Türkçe içerik onaylandı!')}>
              {working ? <Spin /> : <CheckCircle2 size={16} />} Türkçe Taslağı Onayla
            </button>
            <button style={btn('danger')} disabled={working}
              onClick={() => run(() => api('/approve', 'POST', { action: 'reject', notes }), 'Taslak reddedildi; düzenleme gerekli.')}>
              Reddet — Düzeltme Gerekli
            </button>
          </div>
        </div>
      </div>
    );
  }

  function SchedulingPanel() {
    const allApproved = TARGET_LANGS.filter(l => p.translations.find(t => t.lang === l && t.status === 'approved'));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <Alert type="info">
          Yalnızca insan tarafından onaylanmış diller yayınlanabilir. &quot;Hepsini otomatik yayınla&quot; seçeneği yoktur.
        </Alert>

        <div style={card}>
          <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Anlık Yayın</h3>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: C.muted, margin: '0 0 12px' }}>
            Onaylı dilleri hemen yayınlayın:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
            {['tr' as const, ...TARGET_LANGS].map(lang => {
              const isTr = lang === 'tr';
              const isApproved = isTr ? !!p.trApprovedAt : !!p.translations.find(t => t.lang === lang && t.status === 'approved');
              const selected = publishLangs.includes(lang);
              return (
                <button key={lang} onClick={() => setPublishLangs(prev => selected ? prev.filter(l => l !== lang) : [...prev, lang])}
                  disabled={!isApproved}
                  style={{
                    padding: '6px 13px', borderRadius: '7px', border: `2px solid ${selected ? C.gold : C.border}`,
                    background: selected ? '#FFFBEB' : isApproved ? C.card : '#F3F4F6',
                    cursor: isApproved ? 'pointer' : 'not-allowed', opacity: isApproved ? 1 : 0.5,
                    fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 700, color: isApproved ? C.text : C.light,
                  }}>
                  {lang.toUpperCase()} {isApproved ? '✓' : '—'}
                </button>
              );
            })}
          </div>
          <button style={btn('primary')} disabled={working || publishLangs.length === 0}
            onClick={() => run(() => api('/publish', 'POST', { langs: publishLangs }), `${publishLangs.join(', ').toUpperCase()} yayınlandı!`)}>
            {working ? <Spin /> : <Send size={16} />} Seçili Dilleri Yayınla ({publishLangs.length})
          </button>
        </div>

        <div style={card}>
          <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Zamanlanmış Yayın</h3>
          {!process.env.NEXT_PUBLIC_SCHEDULER_ENABLED && (
            <Alert type="warn">
              ⚠️ Zamanlayıcı <strong>hazır değil</strong>. STUDIO_SCHEDULER_ENABLED ortam değişkeni ayarlanmamış.
              Sessizce yayın yapılmaz; manuel yayın kullanın.
            </Alert>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
            <div>
              <span style={label}>Yayın Tarihi & Saati</span>
              <input type="datetime-local" style={input} value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} />
            </div>
            <div>
              <span style={label}>Yayınlanacak Diller (yalnızca onaylılar)</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {['tr', ...allApproved].map(lang => {
                  const sel = scheduleLangs.includes(lang);
                  return (
                    <button key={lang} onClick={() => setScheduleLangs(prev => sel ? prev.filter(l => l !== lang) : [...prev, lang])}
                      style={{
                        padding: '5px 12px', borderRadius: '6px', border: `1px solid ${sel ? C.gold : C.border}`,
                        background: sel ? '#FFFBEB' : C.card, cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 700, color: sel ? C.gold : C.muted,
                      }}>
                      {lang.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
            <button style={btn('primary')} disabled={working || !scheduleDate || scheduleLangs.length === 0}
              onClick={() => run(() => api('/schedule', 'POST', { scheduledFor: scheduleDate, langs: scheduleLangs }), 'Zamanlanmış yayın oluşturuldu!')}>
              {working ? <Spin /> : <Calendar size={16} />} Zamanla
            </button>
          </div>
        </div>
      </div>
    );
  }

  function DistributionPanel() {
    const drafts = p.distribution;
    const PLATFORM_LABELS: Record<string, string> = { newsletter: 'Bülten', instagram: 'Instagram', facebook: 'Facebook', twitter: 'Twitter / X', linkedin: 'LinkedIn', google_business: 'Google Business Profile' };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <Alert type="info">
          Dağıtım taslakları yönetici onayı olmadan yayımlanmaz. Google Business gönderisi yalnızca onaylı ve CMS’te yayınlanmış makale için, aşağıdaki açık onayla paylaşılır.
        </Alert>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button style={btn('primary')} disabled={working || !p.trContent}
            onClick={() => run(() => api('/distribution'), 'Dağıtım taslakları oluşturuldu!')}>
            {working ? <Spin /> : <Sparkles size={16} />} Taslakları Üret
          </button>
        </div>
        {drafts.map(d => (
          <div key={d.id} style={card}>
            <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 700, color: C.text, margin: '0 0 10px' }}>
              {PLATFORM_LABELS[d.platform] ?? d.platform}
            </h3>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: C.muted, whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6 }}>{d.content}</p>
            {d.platform === 'google_business' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                <button
                  style={btn('primary')}
                  disabled={working || !p.trApprovedAt || d.status === 'published'}
                  onClick={() => run(
                    () => api('/distribution/google-business/publish', 'POST'),
                    d.status === 'published' ? 'Google Business gönderisi zaten yayımlandı.' : 'Google Business gönderisi yayımlandı!',
                  )}
                >
                  {working ? <Spin /> : <Send size={15} />} {d.status === 'published' ? 'Yayımlandı' : 'Google’da Yayımla'}
                </button>
                {d.status === 'failed' && (
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#B91C1C' }}>
                    Yayın başarısız. Bağlantı ve işletme konumunu kontrol edin.
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
        {drafts.length === 0 && !working && (
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: C.muted, textAlign: 'center', padding: '20px 0' }}>
            Henüz taslak yok. &quot;Taslakları Üret&quot; butonuna tıklayın.
          </p>
        )}
      </div>
    );
  }

  function AuditPanel() {
    const ACTION_LABELS: Record<string, string> = {
      project_created:      '📁 Proje oluşturuldu',
      project_updated:      '✏️ Proje güncellendi',
      research_completed:   '🔍 Araştırma tamamlandı',
      draft_generated:      '📝 Taslak üretildi',
      seo_checked:          '📊 SEO analizi yapıldı',
      image_generated:      '🖼 Görsel üretildi',
      image_uploaded:       '📤 Görsel yüklendi',
      image_approved:       '✅ Görsel onaylandı',
      image_rejected:       '❌ Görsel reddedildi',
      tr_draft_approved:    '✅ TR taslak onaylandı',
      tr_draft_rejected:    '❌ TR taslak reddedildi',
      translations_started: '🌐 Çeviriler başlatıldı',
      translation_approved: '✅ Çeviri onaylandı',
      translation_rejected: '❌ Çeviri reddedildi',
      translation_updated:  '✏️ Çeviri düzenlendi',
      exported_to_cms:      '📥 CMS\'e aktarıldı',
      distribution_generated: '📣 Dağıtım taslakları üretildi',
      schedule_created:     '🗓 Zamanlandı',
      schedule_cancelled:   '🗓 Zamanlama iptal',
      published:            '🚀 Yayınlandı',
    };
    return (
      <div style={card}>
        <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 16px' }}>İşlem Geçmişi</h3>
        {p.recentAudit.length === 0 ? (
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: C.muted }}>Henüz işlem yok.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {p.recentAudit.map(entry => {
              const detail = entry.detail as Record<string, unknown>;
              return (
                <div key={entry.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px', background: '#F8FAFC', borderRadius: '8px' }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', flex: 1, color: C.text }}>
                    {ACTION_LABELS[entry.action] ?? entry.action}
                    {typeof detail.model === 'string' && detail.model && <span style={{ color: C.light, fontSize: '11px' }}> — {detail.model}</span>}
                    {typeof detail.lang === 'string' && detail.lang && <span style={{ color: C.light, fontSize: '11px' }}> ({detail.lang.toUpperCase()})</span>}
                    {Array.isArray(detail.langs) && <span style={{ color: C.light, fontSize: '11px' }}> ({(detail.langs as string[]).join(', ')})</span>}
                  </span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: C.light, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {new Date(entry.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const panelMap: Record<string, React.ReactNode> = {
    setup:        <SetupPanel />,
    research:     <ResearchPanel />,
    brief:        <ResearchPanel />,   // brief reuses research view
    draft:        <DraftPanel />,
    seo_check:    <SeoPanel />,
    visual:       <VisualPanel />,
    translations: <TranslationsPanel />,
    review:       <ReviewPanel />,
    approval:     <ApprovalPanel />,
    scheduling:   <SchedulingPanel />,
    published:    <ReviewPanel />,
    archived:     <ReviewPanel />,
    distribution: <DistributionPanel />,
    audit:        <AuditPanel />,
  };

  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      <AdminPageHeader
        title={p.titleWorking ?? 'İçerik Projesi'}
        description={`${p.contentType === 'blog' ? 'Blog' : 'Hizmet'} · ${STAGE_LABELS[p.stage as keyof typeof STAGE_LABELS] ?? p.stage}`}
        action={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Link href="/admin/ai-studio"><button style={btn()}>← Geri</button></Link>
            <button style={btn()} onClick={load}><RefreshCw size={15} /></button>
          </div>
        }
      />

      <div style={{ padding: '20px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Stage tracker */}
        <div style={{ marginBottom: '20px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px 20px' }}>
          <StageTracker currentStage={p.stage} onSelect={setActiveStage} />
        </div>

        {/* Flash messages */}
        {error   && <div style={{ marginBottom: '12px' }}><Alert type="error">{error}</Alert></div>}
        {success && <div style={{ marginBottom: '12px' }}><Alert type="success">{success}</Alert></div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px', alignItems: 'start' }}>
          {/* Main panel */}
          <div>
            {/* Active stage tab buttons (secondary nav) */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {['draft', 'seo_check', 'visual', 'translations', 'review', 'approval', 'scheduling'].map(s => (
                <button key={s} onClick={() => setActiveStage(s)} style={{
                  padding: '5px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: activeStage === s ? 700 : 500,
                  background: activeStage === s ? C.navy : '#F3F6FA',
                  color:      activeStage === s ? '#fff'  : C.muted,
                  transition: 'all 0.15s',
                }}>
                  {STAGE_LABELS[s as keyof typeof STAGE_LABELS]}
                </button>
              ))}
              <button onClick={() => setActiveStage('audit')} style={{
                padding: '5px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: activeStage === 'audit' ? 700 : 500,
                background: activeStage === 'audit' ? C.navy : '#F3F6FA',
                color:      activeStage === 'audit' ? '#fff' : C.muted,
              }}>
                Geçmiş
              </button>
              <button onClick={() => setActiveStage('distribution')} style={{
                padding: '5px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: activeStage === 'distribution' ? 700 : 500,
                background: activeStage === 'distribution' ? C.navy : '#F3F6FA',
                color:      activeStage === 'distribution' ? '#fff' : C.muted,
              }}>
                Dağıtım
              </button>
            </div>

            {panelMap[activeStage] ?? <AuditPanel />}
          </div>

          {/* Right sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Project meta */}
            <div style={card}>
              <p style={{ ...label, marginBottom: '10px' }}>Proje Detayları</p>
              {[
                { l: 'Durum', v: STATUS_LABELS[p.status as keyof typeof STATUS_LABELS] ?? p.status },
                { l: 'Tür', v: p.contentType === 'blog' ? 'Blog' : 'Hizmet' },
                { l: 'TR Onay', v: p.trApprovedAt ? '✓ Onaylı' : '✗ Onaylanmamış' },
                { l: 'CMS', v: p.cmsEntityId ? 'DRAFT aktarıldı' : 'Aktarılmadı' },
                { l: 'Görsel', v: approvedImage ? '✓ Onaylı' : '✗ Yok' },
                { l: 'Çeviri', v: `${p.translations.filter(t => t.status === 'approved').length} / ${TARGET_LANGS.length} onaylı` },
                { l: 'Oluşturulma', v: new Date(p.createdAt).toLocaleDateString('tr-TR') },
              ].map(({ l: lbl, v }) => (
                <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: C.muted }}>{lbl}</span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: C.text, fontWeight: 500, textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Stage status */}
            <div style={card}>
              <p style={{ ...label, marginBottom: '10px' }}>Aşama Durumu</p>
              {['research', 'draft', 'seo_check', 'visual', 'translations', 'approval'].map(s => {
                const stageIdx = STAGE_ORDER.indexOf(s as never);
                const currentIdx = STAGE_ORDER.indexOf(p.stage as never);
                const done = currentIdx > stageIdx;
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: done ? '#F0FDF4' : '#F3F6FA', border: `1px solid ${done ? '#BBF7D0' : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', flexShrink: 0 }}>
                      {done ? '✓' : '○'}
                    </div>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: done ? '#059669' : C.muted }}>
                      {STAGE_LABELS[s as keyof typeof STAGE_LABELS]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
