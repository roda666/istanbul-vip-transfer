'use client';

/**
 * /admin/ai-studio — AI İçerik Stüdyosu: Editoryal Takvim
 *
 * Features:
 *  - Stats bar (total / by status)
 *  - Status filter tabs
 *  - Project cards with stage, content type, keywords
 *  - "Yeni İçerik" CTA
 *  - Integration status panel
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Sparkles, Plus, BookOpen, Wrench, Clock, CheckCircle2,
  AlertTriangle, Archive, Send, Eye, RefreshCw,
  Globe, ImageOff, Calendar, ChevronRight,
} from 'lucide-react';
import AdminPageHeader from '../../_components/AdminPageHeader';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:     '#F3F6FA',
  card:   '#FFFFFF',
  border: '#D8E1E9',
  navy:   '#132A44',
  gold:   '#C99A32',
  text:   '#172B3A',
  muted:  '#52697A',
  light:  '#718596',
};

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', background: C.card,
  border: `1px solid ${C.border}`, borderRadius: '8px',
  color: C.text, fontSize: '13px', fontFamily: 'Inter, sans-serif',
  outline: 'none', boxSizing: 'border-box',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface Project {
  id: string;
  contentType: string;
  stage: string;
  status: string;
  titleWorking: string | null;
  config: Record<string, unknown>;
  trApprovedAt: string | null;
  publishedAt: string | null;
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Config {
  openai: { configured: boolean; label: string };
  imageGeneration: { configured: boolean; label: string };
  scheduler: { ready: boolean; label: string };
  keywordData: { connected: boolean; label: string };
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  draft:     'Taslak',
  in_review: 'İncelemede',
  approved:  'Onaylı',
  scheduled: 'Planlandı',
  published: 'Yayınlandı',
  archived:  'Arşivlendi',
};
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft:     { bg: '#FFFBEB', text: '#D97706' },
  in_review: { bg: '#EFF6FF', text: '#2563EB' },
  approved:  { bg: '#F0FDF4', text: '#168C5B' },
  scheduled: { bg: '#F5F3FF', text: '#7C3AED' },
  published: { bg: '#ECFDF5', text: '#059669' },
  archived:  { bg: '#F3F4F6', text: '#6B7280' },
};

const STAGE_LABELS: Record<string, string> = {
  setup:        '① Kurulum',
  research:     '② Araştırma',
  brief:        '③ Özet',
  draft:        '④ Taslak',
  seo_check:    '⑤ SEO',
  visual:       '⑥ Görsel',
  translations: '⑦ Çeviriler',
  review:       '⑧ İnceleme',
  approval:     '⑨ Onay',
  scheduling:   '⑩ Zamanlama',
  published:    '✓ Yayınlandı',
  archived:     '— Arşiv',
};

const FILTER_TABS = [
  { key: 'all',       label: 'Tümü' },
  { key: 'draft',     label: 'Taslak' },
  { key: 'in_review', label: 'İncelemede' },
  { key: 'approved',  label: 'Onaylı' },
  { key: 'scheduled', label: 'Planlandı' },
  { key: 'published', label: 'Yayınlandı' },
  { key: 'archived',  label: 'Arşiv' },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', minWidth: '120px' }}>
      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '22px', fontWeight: 700, color: C.text, margin: 0 }}>{value}</p>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: C.light, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const statusColor = STATUS_COLORS[project.status] ?? { bg: '#F3F4F6', text: '#6B7280' };
  const cfg = project.config;
  const keywords = (Array.isArray(cfg.keywords) ? cfg.keywords : []) as string[];

  return (
    <Link href={`/admin/ai-studio/${project.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px',
        padding: '16px 20px', cursor: 'pointer', transition: 'box-shadow 0.15s',
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(19,42,68,0.1)')}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
      >
        {/* Row 1: type + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: C.muted, fontFamily: 'Inter, sans-serif', background: '#F3F6FA', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
            {project.contentType === 'blog' ? <BookOpen size={12} /> : <Wrench size={12} />}
            {project.contentType === 'blog' ? 'Blog' : 'Hizmet'}
          </span>
          <span style={{ fontSize: '11px', fontFamily: 'Inter, sans-serif', background: statusColor.bg, color: statusColor.text, padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
            {STATUS_LABELS[project.status] ?? project.status}
          </span>
          <span style={{ fontSize: '11px', fontFamily: 'Inter, sans-serif', color: C.light, marginLeft: 'auto' }}>
            {STAGE_LABELS[project.stage] ?? project.stage}
          </span>
        </div>

        {/* Row 2: title */}
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600, color: C.text, margin: 0, lineHeight: 1.4 }}>
          {project.titleWorking ?? '(Başlıksız proje)'}
        </p>

        {/* Row 3: keywords + meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {keywords.slice(0, 3).map((kw, i) => (
            <span key={i} style={{ fontSize: '11px', fontFamily: 'Inter, sans-serif', background: '#EFF6FF', color: '#2563EB', padding: '2px 7px', borderRadius: '5px' }}>
              {kw}
            </span>
          ))}
          {keywords.length > 3 && (
            <span style={{ fontSize: '11px', color: C.light, fontFamily: 'Inter, sans-serif' }}>+{keywords.length - 3}</span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: C.light, fontFamily: 'Inter, sans-serif' }}>
            {new Date(project.updatedAt).toLocaleDateString('tr-TR')}
          </span>
          <ChevronRight size={14} color={C.light} />
        </div>

        {/* Scheduled date */}
        {project.scheduledFor && project.status === 'scheduled' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#7C3AED', fontFamily: 'Inter, sans-serif', background: '#F5F3FF', padding: '4px 8px', borderRadius: '6px' }}>
            <Calendar size={12} />
            {new Date(project.scheduledFor).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })} tarihinde yayınlanacak
          </div>
        )}
      </div>
    </Link>
  );
}

function ConfigStatus({ config }: { config: Config }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px 20px' }}>
      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
        Entegrasyon Durumu
      </p>
      {([
        { label: 'OpenAI', ok: config.openai.configured, text: config.openai.label },
        { label: 'Görsel', ok: config.imageGeneration.configured, text: config.imageGeneration.label },
        { label: 'Zamanlayıcı', ok: config.scheduler.ready, text: config.scheduler.label },
        { label: 'Anahtar Kelime', ok: config.keywordData.connected, text: config.keywordData.label },
      ] as const).map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.ok ? '#168C5B' : '#D97706', flexShrink: 0, marginTop: '4px' }} />
          <div>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600, color: C.text }}>{item.label}: </span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: C.muted }}>{item.text}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AiStudioPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [config, setConfig]     = useState<Config | null>(null);
  const [filter, setFilter]     = useState('all');
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch('/admin/api/studio/projects'),
        fetch('/admin/api/studio/config'),
      ]);
      if (pRes.ok) {
        const { projects } = await pRes.json() as { projects: Project[] };
        setProjects(projects);
      }
      if (cRes.ok) setConfig(await cRes.json() as Config);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter);

  // Stats
  const total     = projects.length;
  const published = projects.filter(p => p.status === 'published').length;
  const scheduled = projects.filter(p => p.status === 'scheduled').length;
  const pending   = projects.filter(p => ['draft', 'in_review', 'approved'].includes(p.status)).length;

  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      <AdminPageHeader
        title="AI İçerik Stüdyosu"
        description="Araştırma → Taslak → SEO → Görsel → Çeviri → Onay → Yayın"
        action={
          <Link href="/admin/ai-studio/yeni">
            <button style={{ display: 'flex', alignItems: 'center', gap: '6px', background: C.gold, color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={16} /> Yeni İçerik
            </button>
          </Link>
        }
      />

      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <StatCard label="Toplam" value={total} color={C.navy} icon={<Sparkles size={18} />} />
          <StatCard label="Bekliyor" value={pending} color="#D97706" icon={<Clock size={18} />} />
          <StatCard label="Planlandı" value={scheduled} color="#7C3AED" icon={<Calendar size={18} />} />
          <StatCard label="Yayınlandı" value={published} color="#168C5B" icon={<CheckCircle2 size={18} />} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px', alignItems: 'start' }}>
          {/* Left column */}
          <div>
            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', marginBottom: '16px', padding: '2px' }}>
              {FILTER_TABS.map(tab => (
                <button key={tab.key} onClick={() => setFilter(tab.key)} style={{
                  padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
                  background: filter === tab.key ? C.navy : C.card,
                  color:      filter === tab.key ? '#fff' : C.muted,
                  boxShadow:  filter === tab.key ? 'none' : `0 0 0 1px ${C.border}`,
                  transition: 'all 0.15s',
                }}>
                  {tab.label}
                  {tab.key !== 'all' && (
                    <span style={{ marginLeft: '5px', opacity: 0.7 }}>
                      ({projects.filter(p => p.status === tab.key).length})
                    </span>
                  )}
                </button>
              ))}
              <button onClick={load} style={{ marginLeft: 'auto', padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: '8px', background: C.card, cursor: 'pointer', color: C.muted, display: 'flex', alignItems: 'center' }}>
                <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>

            {/* Project list */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: C.muted }}>
                Yükleniyor…
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: 'Inter, sans-serif', color: C.muted }}>
                <Sparkles size={40} color={C.border} style={{ display: 'block', margin: '0 auto 12px' }} />
                {filter === 'all' ? (
                  <>
                    <p style={{ fontSize: '15px', fontWeight: 600, color: C.text, margin: '0 0 8px' }}>Henüz içerik yok</p>
                    <Link href="/admin/ai-studio/yeni">
                      <button style={{ background: C.gold, color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer' }}>
                        İlk İçeriği Oluştur
                      </button>
                    </Link>
                  </>
                ) : (
                  <p style={{ fontSize: '14px' }}>Bu filtre için içerik yok.</p>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filtered.map(p => <ProjectCard key={p.id} project={p} />)}
              </div>
            )}
          </div>

          {/* Right column: config status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {config && <ConfigStatus config={config} />}

            {/* System Check link */}
            <Link href="/admin/ai-studio/sistem-kontrolu" style={{ textDecoration: 'none' }}>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(19,42,68,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
              >
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Wrench size={14} color="#2563EB" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 700, color: C.text, margin: 0 }}>Sistem Kontrolü</p>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: C.muted, margin: 0 }}>DB, OpenAI, 9 dil durumu</p>
                </div>
                <ChevronRight size={14} color={C.muted} />
              </div>
            </Link>

            {/* Quick tips */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px 20px' }}>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
                Akış
              </p>
              {['Araştırma', 'İçerik Özeti', 'TR Taslak', 'SEO & Doğruluk', 'Görsel', 'Çeviriler (8 dil)', 'İnceleme', 'Onay', 'Zamanlama / Yayın'].map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                  <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#F3F6FA', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: C.muted, fontFamily: 'Inter, sans-serif', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: C.text }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
