'use client';

/**
 * /admin/ai-studio/yeni — Yeni İçerik Projesi Oluştur
 *
 * 3-step wizard:
 *  1. İçerik türü + çalışma başlığı
 *  2. Anahtar kelimeler + hedef kitle + arama niyeti
 *  3. Ton + kelime hedefi + notlar + yayın tarihi
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Wrench, ChevronRight, ChevronLeft, Plus, X } from 'lucide-react';
import AdminPageHeader from '../../../_components/AdminPageHeader';
import Link from 'next/link';

const C = {
  bg: '#F3F6FA', card: '#FFFFFF', border: '#D8E1E9',
  navy: '#132A44', gold: '#C99A32', text: '#172B3A', muted: '#52697A', light: '#718596',
};
const label: React.CSSProperties = { display: 'block', fontFamily: 'Inter, sans-serif', fontSize: '11px', color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 };
const input: React.CSSProperties = { width: '100%', padding: '9px 12px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, fontSize: '13px', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' };
const btn = (primary?: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '9px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
  fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600,
  background: primary ? C.gold : C.card,
  color:      primary ? '#fff'  : C.muted,
  boxShadow:  primary ? 'none'  : `0 0 0 1px ${C.border}`,
});

const SERVICE_TYPES = ['airport_transfer', 'intercity', 'vip_tour', 'corporate'];
const SERVICE_TYPE_LABELS: Record<string, string> = { airport_transfer: 'Havalimanı Transfer', intercity: 'Şehirlerarası', vip_tour: 'VIP Tur', corporate: 'Kurumsal' };
const INTENTS = [{ v: 'informational', l: 'Bilgilendirme' }, { v: 'commercial', l: 'Ticari' }, { v: 'navigational', l: 'Navigasyon' }, { v: 'transactional', l: 'İşlem' }];
const ARTICLE_TYPES = ['Rehber', 'Liste', 'Karşılaştırma', 'SSS', 'Nasıl Yapılır', 'Vaka Analizi'];
const TONES = ['Profesyonel', 'Samimi', 'Heyecan Verici', 'Bilimsel', 'Rahat'];

interface FormData {
  contentType: 'blog' | 'service';
  titleWorking: string;
  serviceType: string;
  searchIntent: string;
  cityOrRoute: string;
  audience: string;
  keywords: string[];
  articleType: string;
  tone: string;
  wordCountTarget: number;
  publishDate: string;
  notes: string;
}

export default function YeniStudioPage() {
  const router = useRouter();
  const [step, setStep]     = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [kwInput, setKwInput] = useState('');

  const [form, setForm] = useState<FormData>({
    contentType: 'blog',
    titleWorking: '',
    serviceType: 'airport_transfer',
    searchIntent: 'informational',
    cityOrRoute: '',
    audience: '',
    keywords: [],
    articleType: 'Rehber',
    tone: 'Profesyonel',
    wordCountTarget: 1200,
    publishDate: '',
    notes: '',
  });

  function set<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  function addKeyword() {
    const kw = kwInput.trim();
    if (kw && !form.keywords.includes(kw)) set('keywords', [...form.keywords, kw]);
    setKwInput('');
  }

  async function handleSubmit() {
    if (!form.titleWorking.trim()) { setError('Çalışma başlığı zorunludur.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/admin/api/studio/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType:  form.contentType,
          titleWorking: form.titleWorking,
          config: {
            serviceType:     form.serviceType,
            searchIntent:    form.searchIntent,
            cityOrRoute:     form.cityOrRoute || undefined,
            audience:        form.audience || undefined,
            keywords:        form.keywords,
            publishDate:     form.publishDate || undefined,
            tone:            form.tone,
            wordCountTarget: form.wordCountTarget,
            articleType:     form.articleType,
            notes:           form.notes || undefined,
          },
        }),
      });
      if (!res.ok) {
        const { error } = await res.json() as { error: string };
        throw new Error(error);
      }
      const { project } = await res.json() as { project: { id: string } };
      router.push(`/admin/ai-studio/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Proje oluşturulamadı.');
      setSaving(false);
    }
  }

  const stepTitles = ['İçerik Türü', 'Hedef & Anahtar Kelimeler', 'Ayarlar & Tamamla'];

  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      <AdminPageHeader
        title="Yeni İçerik Projesi"
        description="AI yardımıyla içerik akışını başlat"
        action={
          <Link href="/admin/ai-studio">
            <button style={btn()}>Vazgeç</button>
          </Link>
        }
      />

      <div style={{ padding: '24px', maxWidth: '680px', margin: '0 auto' }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '28px' }}>
          {stepTitles.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                  background: i + 1 === step ? C.navy : i + 1 < step ? C.gold : '#E2E8F0',
                  color: i + 1 <= step ? '#fff' : C.muted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 700,
                }}>{i + 1}</div>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: i + 1 === step ? 600 : 400, color: i + 1 === step ? C.text : C.light, whiteSpace: 'nowrap' }}>{t}</span>
              </div>
              {i < stepTitles.length - 1 && <div style={{ flex: 1, height: '1px', background: i + 1 < step ? C.gold : C.border, margin: '0 8px' }} />}
            </div>
          ))}
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#DC2626' }}>
            {error}
          </div>
        )}

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <span style={label}>İçerik Türü</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {(['blog', 'service'] as const).map(type => (
                  <button key={type} onClick={() => set('contentType', type)} style={{
                    border: `2px solid ${form.contentType === type ? C.gold : C.border}`,
                    borderRadius: '10px', padding: '16px', background: form.contentType === type ? '#FFFBEB' : C.card,
                    cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      {type === 'blog' ? <BookOpen size={18} color={form.contentType === type ? C.gold : C.muted} /> : <Wrench size={18} color={form.contentType === type ? C.gold : C.muted} />}
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 700, color: C.text }}>{type === 'blog' ? 'Blog Yazısı' : 'Hizmet Sayfası'}</span>
                    </div>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: C.muted, margin: 0 }}>
                      {type === 'blog' ? 'Rehber, liste, SSS veya makale' : 'Hizmet açıklama ve SEO sayfası'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span style={label}>Çalışma Başlığı *</span>
              <input
                style={input} placeholder="Örn: İstanbul Havalimanı Transfer Rehberi 2025"
                value={form.titleWorking}
                onChange={e => set('titleWorking', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && form.titleWorking.trim() && setStep(2)}
              />
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: C.light, margin: '4px 0 0' }}>
                Bu başlık yalnızca admin panelinde görünür; AI nihai başlığı üretecek.
              </p>
            </div>

            {form.contentType === 'service' && (
              <div>
                <span style={label}>Hizmet Türü</span>
                <select style={input} value={form.serviceType} onChange={e => set('serviceType', e.target.value)}>
                  {SERVICE_TYPES.map(t => <option key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
            )}

            <div>
              <span style={label}>Makale Türü</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {ARTICLE_TYPES.map(t => (
                  <button key={t} onClick={() => set('articleType', t)} style={{
                    padding: '5px 12px', borderRadius: '6px', border: `1px solid ${form.articleType === t ? C.gold : C.border}`,
                    background: form.articleType === t ? '#FFFBEB' : C.card, cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600,
                    color: form.articleType === t ? C.gold : C.muted,
                  }}>{t}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <span style={label}>Arama Niyeti</span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {INTENTS.map(({ v, l }) => (
                  <button key={v} onClick={() => set('searchIntent', v)} style={{
                    padding: '7px 14px', borderRadius: '8px', border: `1px solid ${form.searchIntent === v ? C.gold : C.border}`,
                    background: form.searchIntent === v ? '#FFFBEB' : C.card, cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600,
                    color: form.searchIntent === v ? C.gold : C.muted,
                  }}>{l}</button>
                ))}
              </div>
            </div>

            <div>
              <span style={label}>Şehir / Rota</span>
              <input style={input} placeholder="Örn: İstanbul, İstanbul → Ankara" value={form.cityOrRoute} onChange={e => set('cityOrRoute', e.target.value)} />
            </div>

            <div>
              <span style={label}>Hedef Kitle</span>
              <input style={input} placeholder="Örn: İş seyahati yapan profesyoneller, aile tatilcileri" value={form.audience} onChange={e => set('audience', e.target.value)} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{ ...label, margin: 0 }}>Anahtar Kelimeler</span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#7C3AED', background: '#F5F3FF', padding: '2px 8px', borderRadius: '5px' }}>Manuel — AI tahmini</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  style={{ ...input, flex: 1 }}
                  placeholder="Anahtar kelime ekle ve Enter'a bas"
                  value={kwInput}
                  onChange={e => setKwInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                />
                <button onClick={addKeyword} style={{ ...btn(true), padding: '9px 14px' }}>
                  <Plus size={16} />
                </button>
              </div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: C.light, margin: '4px 0 8px' }}>
                Google Search Console bağlı değil — bu anahtar kelimeler &quot;manuel&quot; olarak etiketlenecek.
              </p>
              {form.keywords.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {form.keywords.map((kw, i) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#EFF6FF', color: '#2563EB', fontSize: '12px', fontFamily: 'Inter, sans-serif', padding: '4px 10px', borderRadius: '6px' }}>
                      {kw}
                      <button onClick={() => set('keywords', form.keywords.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563EB', display: 'flex', padding: 0 }}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <span style={label}>Yazı Tonu</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {TONES.map(t => (
                  <button key={t} onClick={() => set('tone', t)} style={{
                    padding: '6px 13px', borderRadius: '7px', border: `1px solid ${form.tone === t ? C.gold : C.border}`,
                    background: form.tone === t ? '#FFFBEB' : C.card, cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600,
                    color: form.tone === t ? C.gold : C.muted,
                  }}>{t}</button>
                ))}
              </div>
            </div>

            <div>
              <span style={label}>Hedef Kelime Sayısı: {form.wordCountTarget}</span>
              <input type="range" min={300} max={4000} step={100} value={form.wordCountTarget}
                onChange={e => set('wordCountTarget', Number(e.target.value))}
                style={{ width: '100%', accentColor: C.gold }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Inter, sans-serif', fontSize: '11px', color: C.light }}>
                <span>300</span><span>4.000</span>
              </div>
            </div>

            <div>
              <span style={label}>Önerilen Yayın Tarihi</span>
              <input type="date" style={input} value={form.publishDate} onChange={e => set('publishDate', e.target.value)} />
            </div>

            <div>
              <span style={label}>Notlar (AI için bağlam)</span>
              <textarea style={{ ...input, resize: 'vertical', minHeight: '80px' }}
                placeholder="Özel gereksinimler, vurgulanacak noktalar, kaçınılacak konular…"
                value={form.notes} onChange={e => set('notes', e.target.value)}
              />
            </div>

            {/* Summary */}
            <div style={{ background: '#F8FAFC', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '12px 16px', fontFamily: 'Inter, sans-serif', fontSize: '12px', color: C.muted }}>
              <strong style={{ color: C.text }}>{form.contentType === 'blog' ? 'Blog' : 'Hizmet'} · </strong>
              {form.titleWorking} · {form.tone} · {form.wordCountTarget} kelime ·{' '}
              {form.keywords.length} anahtar kelime (manuel etiketli)
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
          {step > 1 ? (
            <button onClick={() => setStep(s => s - 1)} style={btn()}>
              <ChevronLeft size={16} /> Geri
            </button>
          ) : <div />}

          {step < 3 ? (
            <button
              onClick={() => { if (step === 1 && !form.titleWorking.trim()) { setError('Çalışma başlığı zorunludur.'); return; } setError(''); setStep(s => s + 1); }}
              style={btn(true)}
            >
              İleri <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving} style={btn(true)}>
              {saving ? 'Oluşturuluyor…' : 'Projeyi Oluştur →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
