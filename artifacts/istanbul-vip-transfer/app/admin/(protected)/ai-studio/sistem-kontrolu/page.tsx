'use client';
/**
 * /admin/ai-studio/sistem-kontrolu — AI İçerik Stüdyosu Sistem Kontrolü
 *
 * Gerçek zamanlı entegrasyon durumu:
 *  • Veritabanı ping
 *  • OpenAI metin modeli (gerçek API çağrısı)
 *  • DALL-E 3 görsel üretimi
 *  • Nesne depolama
 *  • CMS DRAFT aktarımı
 *  • 9 dil matrisi (TR kaynak + 8 hedef)
 *  • Zamanlayıcı
 *  • Google Search Console (bağlı değil)
 *  • Sosyal medya / bülten (bağlı değil)
 *
 * Hiçbir Secret veya API anahtarı gösterilmez.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Loader2, Database, Zap, ImageIcon, Calendar, BookOpen } from 'lucide-react';
import AdminPageHeader from '../../../_components/AdminPageHeader';
import { beginSystemHealthRefresh, failSystemHealthRefresh } from '@/lib/studio/system-health-client';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = { bg: '#F3F6FA', card: '#FFFFFF', border: '#D8E1E9', navy: '#132A44', gold: '#C99A32', text: '#172B3A', muted: '#52697A' };

interface ConfigData {
  database:         { status: HealthStatus; label: string; studioProjects: number | null; migration: { status: HealthStatus; label: string; detail?: string; missing: string[] } };
  openai:           { configured: boolean; ok: boolean; status: HealthStatus; model: string; label: string };
  imageGeneration:  { configured: boolean; ok: boolean; status: HealthStatus; model: string | null; label: string };
  storage:          { configured: boolean; status: HealthStatus; label: string };
  scheduler:        { ready: boolean; status: HealthStatus; label: string };
  cms:              { status: HealthStatus; label: string };
  translation:      { ok: boolean; status: HealthStatus; label: string };
  languages:        Array<{ code: string; name: string; role: string; configured: boolean }>;
  keywordData:      { connected: boolean; label: string; providers: string[] };
  social:           Record<string, { connected: boolean; label: string }>;
  checkedAt:        string;
}

type HealthStatus = 'ok' | 'warn' | 'error';
type StatusLevel = HealthStatus | 'loading';

function StatusDot({ level }: { level: StatusLevel }) {
  const colors = { ok: '#059669', warn: '#D97706', error: '#DC2626', loading: '#6B7280' };
  const size = 10;
  if (level === 'loading') {
    return <Loader2 size={size + 4} color={colors.loading} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: colors[level], flexShrink: 0 }} />
  );
}

function StatusBadge({ level, label }: { level: StatusLevel; label: string }) {
  const styles = {
    ok:      { bg: '#F0FDF4', border: '#BBF7D0', text: '#059669' },
    warn:    { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E' },
    error:   { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626' },
    loading: { bg: '#F9FAFB', border: '#E5E7EB', text: '#6B7280' },
  }[level];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 600, background: styles.bg, border: `1px solid ${styles.border}`, color: styles.text }}>
      <StatusDot level={level} />
      {label}
    </span>
  );
}

function Card({ icon, title, level, label, detail, extra }: {
  icon: React.ReactNode;
  title: string;
  level: StatusLevel;
  label: string;
  detail?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#F3F6FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 700, color: C.text }}>{title}</span>
            <StatusBadge level={level} label={level === 'ok' ? 'Aktif' : level === 'warn' ? 'Uyarı' : level === 'loading' ? 'Kontrol ediliyor…' : 'Hata'} />
          </div>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: C.muted, margin: '0 0 4px', lineHeight: 1.4 }}>{label}</p>
          {detail && <p style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94A3B8', margin: 0 }}>{detail}</p>}
          {extra}
        </div>
      </div>
    </div>
  );
}

export default function SistemKontrolPage() {
  const [data, setData]       = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [checkedAt, setCheckedAt] = useState('');

  const check = useCallback(async () => {
    const reset = beginSystemHealthRefresh();
    setData(reset.data);
    setCheckedAt(reset.checkedAt);
    setLoading(true); setError('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25_000);
    try {
      const res = await fetch('/admin/api/studio/config', { signal: controller.signal });
      if (!res.ok) throw new Error(res.status === 401 ? 'Oturumunuz sona erdi.' : 'Kontrol sonucu alınamadı.');
      const json = await res.json() as ConfigData;
      setData(json);
      setCheckedAt(new Date(json.checkedAt).toLocaleString('tr-TR'));
    } catch (e) {
      // A previous green response is not evidence of current health after a
      // failed refresh. Clear it instead of presenting stale service status.
      const failed = failSystemHealthRefresh();
      setData(failed.data);
      setCheckedAt(failed.checkedAt);
      setError(e instanceof DOMException && e.name === 'AbortError'
        ? 'Sistem kontrolü zaman aşımına uğradı. Lütfen yeniden deneyin.'
        : 'Sistem kontrolü alınamadı. Lütfen yeniden deneyin.');
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }, []);

  useEffect(() => { void check(); }, [check]);

  const level = (status: HealthStatus | undefined): StatusLevel => {
    if (loading) return 'loading';
    return status ?? 'error';
  };
  const unavailableLabel = (label: string | undefined) =>
    label ?? (error ? 'Kontrol sonucu alınamadı — Yenile ile tekrar deneyin' : 'Kontrol sonucu alınamadı.');

  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      <AdminPageHeader
        title="Sistem Kontrolü"
        description="AI İçerik Stüdyosu entegrasyon durumu — gerçek zamanlı"
        action={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Link href="/admin/ai-studio">
              <button style={{ padding: '8px 16px', borderRadius: '8px', border: `1px solid ${C.border}`, background: C.card, fontFamily: 'Inter, sans-serif', fontSize: '12px', cursor: 'pointer', color: C.text }}>
                ← Stüdyo
              </button>
            </Link>
            <button onClick={check} disabled={loading} style={{ padding: '8px 14px', borderRadius: '8px', border: `1px solid ${C.border}`, background: C.card, fontFamily: 'Inter, sans-serif', fontSize: '12px', cursor: 'pointer', color: C.text, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
              Yenile
            </button>
          </div>
        }
      />

      <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
        {/* Error banner */}
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#DC2626' }}>
            ⚠️ Sistem kontrolü alınamadı: {error}
          </div>
        )}

        {/* Last check timestamp */}
        {checkedAt && !loading && (
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#94A3B8', marginBottom: '16px', textAlign: 'right' }}>
            Son kontrol: {checkedAt}
          </p>
        )}

        {/* Core infrastructure */}
        <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
          Temel Altyapı
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <Card
            icon={<Database size={16} color={C.navy} />}
            title="Veritabanı"
            level={level(data?.database.status)}
            label={unavailableLabel(data?.database.label)}
            detail={data?.database.studioProjects === null || !data
              ? data?.database.migration.label
              : `Studio projeleri: ${data.database.studioProjects} · ${data.database.migration.label}`}
          />
          <Card
            icon={<Zap size={16} color={C.navy} />}
            title="OpenAI Metin Modeli"
            level={level(data?.openai.status)}
            label={unavailableLabel(data?.openai.label)}
            detail={data?.openai.ok ? `Model: ${data.openai.model}` : undefined}
          />
          <Card
            icon={<ImageIcon size={16} color={C.navy} />}
            title="DALL-E 3 Görsel Üretimi"
            level={level(data?.imageGeneration.status)}
            label={unavailableLabel(data?.imageGeneration.label)}
            detail={data?.imageGeneration.ok ? 'Erişim, görsel oluşturmadan doğrulandı' : 'Manuel yükleme ile devam edebilirsiniz'}
          />
          <Card
            icon={<Database size={16} color={C.navy} />}
            title="Nesne Depolama"
            level={level(data?.storage.status)}
            label={unavailableLabel(data?.storage.label)}
            detail={data?.storage.configured ? 'İmzalı URL kontrolü yapılır; dosya yazılmaz.' : 'AI görselleri kalıcı olmayabilir'}
          />
          <Card
            icon={<BookOpen size={16} color={C.navy} />}
            title="CMS DRAFT Aktarımı"
            level={level(data?.cms.status)}
            label={unavailableLabel(data?.cms.label)}
            detail="Yalnızca Blog/Hizmetler DRAFT — otomatik yayın yok"
          />
          <Card
            icon={<Calendar size={16} color={C.navy} />}
            title="Zamanlanmış Yayın"
            level={level(data?.scheduler.status)}
            label={unavailableLabel(data?.scheduler.label)}
            detail={data?.scheduler.ready ? 'Cron kimlik doğrulaması ve taslak şeması doğrulandı' : 'Manuel taslak oluşturma kullanılabilir'}
          />
          <Card
            icon={<Zap size={16} color={C.navy} />}
            title="Çeviri Hazırlığı"
            level={level(data?.translation.status)}
            label={unavailableLabel(data?.translation.label)}
            detail="Hedef diller aynı metin modeli üzerinden çevrilir."
          />
        </div>

        {/* 9-Language matrix */}
        <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
          9 Dil Desteği
        </h2>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px 20px', marginBottom: '24px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: C.muted, fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Kontrol ediliyor…
            </div>
          ) : data ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
              {(data?.languages ?? []).map(lang => (
                <div key={lang.code} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: '#F8FAFC', border: `1px solid ${lang.configured ? '#BBF7D0' : C.border}` }}>
                  <StatusDot level={lang.configured ? 'ok' : 'error'} />
                  <div>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 700, color: C.text, margin: 0 }}>
                      {lang.code.toUpperCase()} — {lang.name}
                    </p>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: C.muted, margin: 0 }}>
                      {lang.role === 'source' ? '📝 Kaynak dil' : lang.configured ? '✓ AI çevirisi hazır' : '✗ OpenAI bağlı değil'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#DC2626' }}>
              Dil hazırlığı kontrolü alınamadı. Yenile ile tekrar deneyin.
            </p>
          )}
          <div style={{ marginTop: '12px', padding: '10px 12px', background: '#FFFBEB', borderRadius: '8px', border: '1px solid #FDE68A' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#92400E', margin: 0 }}>
              ⚠️ <strong>Arapça (AR):</strong> RTL metin akışı, telefon numaraları ve havalimanı kodları (IST, SAW) için Unicode LTR bidi işaretleyicileri (‪…‬) uygulanır. Önizlemede LTR korumalı öğeleri kontrol edin.
            </p>
          </div>
        </div>

        {/* Keyword & SEO */}
        <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
          SEO & Anahtar Kelime Verileri
        </h2>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px 20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
            <XCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, color: C.text, margin: '0 0 4px' }}>
                {data?.keywordData.label ?? 'Kontrol ediliyor…'}
              </p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: C.muted, margin: 0 }}>
                {data?.keywordData.connected
                  ? <>Google Ads Keyword Planner sorguları gerçek sağlayıcı verisini <strong>Türkiye / Türkçe</strong> kapsamı ve sağlayıcı etiketiyle gösterir. Tam eşleşme dönmezse metrik gösterilmez.</>
                  : <>Sağlayıcı kullanılamadığı için hacim veya rekabet metriği gösterilmez. Manuel anahtar kelimeler metrik değildir; AI tahmini olarak sunulmaz.</>}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {(data?.keywordData.providers ?? ['Google Search Console (bağlı değil)', 'Ahrefs (bağlı değil)', 'SEMrush (bağlı değil)']).map(p => (
              <span key={p} style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', background: '#F3F4F6', color: '#6B7280', padding: '3px 9px', borderRadius: '5px' }}>{p}</span>
            ))}
          </div>
          <Link href="/admin/ai-studio/yeni" style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#2563EB' }}>
            Anahtar kelime araştırmasını yeni proje ekranından başlat →
          </Link>
        </div>

        {/* Social & newsletter */}
        <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
          Sosyal Medya & Bülten
        </h2>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px 20px', marginBottom: '24px' }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#1D4ED8', margin: '0 0 12px', padding: '8px 12px', background: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
            ℹ️ Tüm dağıtım taslakları yalnızca admin panelinde kaydedilir. Bu entegrasyonlar <strong>bağlı olmasa bile</strong> taslak oluşturulabilir. Hiçbir platforma otomatik gönderi yapılmaz.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
            {data ? Object.entries(data.social).map(([platform, info]) => (
              <div key={platform} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: '#F8FAFC', border: `1px solid ${C.border}` }}>
                <XCircle size={12} color="#DC2626" />
                <div>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 700, color: C.text, margin: 0 }}>{platform.charAt(0).toUpperCase() + platform.slice(1)}</p>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: C.muted, margin: 0 }}>{info.label}</p>
                </div>
              </div>
            )) : (
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: C.muted }}>Kontrol ediliyor…</div>
            )}
          </div>
        </div>

        {/* Summary */}
        {data && !loading && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px 20px' }}>
            <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 700, color: C.text, margin: '0 0 12px' }}>Özet</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[
                { label: 'Veritabanı', status: data.database.status },
                { label: 'Studio şeması', status: data.database.migration.status },
                { label: 'OpenAI', status: data.openai.status },
                { label: 'DALL-E 3', status: data.imageGeneration.status },
                { label: 'Depolama', status: data.storage.status },
                { label: 'CMS', status: data.cms.status },
                { label: 'Zamanlayıcı', status: data.scheduler.status },
                { label: '9 Dil', status: data.translation.status },
              ].map(({ label, status }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {status === 'ok'
                    ? <CheckCircle2 size={14} color="#059669" />
                    : <AlertTriangle size={14} color="#D97706" />}
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: status === 'ok' ? '#059669' : '#D97706', fontWeight: 600 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
