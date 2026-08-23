'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CheckCircle2, ImageIcon, Loader2, RefreshCw, Send, Sparkles } from 'lucide-react';
import AdminPageHeader from '../../../_components/AdminPageHeader';

const C = {
  bg: '#F3F6FA', card: '#FFFFFF', border: '#D8E1E9', navy: '#132A44',
  gold: '#C99A32', text: '#172B3A', muted: '#52697A', light: '#718596',
};

type ContentType = 'BLOG_POST' | 'SERVICE';
type Placement = 'hero' | 'body';

interface Target {
  id: string;
  slug: string;
  title: string;
}

interface GeneratedImage {
  imagePath: string;
  prompt: string;
  altText: string;
  model: string;
}

const fieldStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`,
  borderRadius: '8px', padding: '10px 12px', color: C.text, background: '#fff',
  fontFamily: 'Inter, sans-serif', fontSize: '13px', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: '6px', color: C.muted, fontFamily: 'Inter, sans-serif',
  fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
};

function serverMessage(data: unknown, fallback: string) {
  if (data && typeof data === 'object') {
    const value = (data as Record<string, unknown>).error ?? (data as Record<string, unknown>).message;
    if (typeof value === 'string' && value.trim()) return value;
  }
  return fallback;
}

export default function StudioImageGeneratorPage() {
  const [contentType, setContentType] = useState<ContentType>('BLOG_POST');
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetId, setTargetId] = useState('');
  const [placement, setPlacement] = useState<Placement>('hero');
  const [prompt, setPrompt] = useState('');
  const [altText, setAltText] = useState('');
  const [generated, setGenerated] = useState<GeneratedImage | null>(null);
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadTargets = useCallback(async (type: ContentType) => {
    setTargetsLoading(true);
    setError('');
    try {
      const response = await fetch(`/admin/api/studio/images?target=${type}`);
      const data = await response.json().catch(() => null) as { targets?: Target[] } | null;
      if (!response.ok) throw new Error(serverMessage(data, 'İçerik kayıtları yüklenemedi.'));
      const nextTargets = Array.isArray(data?.targets) ? data.targets : [];
      setTargets(nextTargets);
      setTargetId(current => nextTargets.some(target => target.id === current) ? current : '');
    } catch (caught) {
      setTargets([]);
      setTargetId('');
      setError(caught instanceof Error ? caught.message : 'İçerik kayıtları yüklenemedi.');
    } finally {
      setTargetsLoading(false);
    }
  }, []);

  useEffect(() => { void loadTargets(contentType); }, [contentType, loadTargets]);

  function clearNotices() {
    setError('');
    setSuccess('');
  }

  function validate() {
    if (!targetId) {
      setError('Lütfen görselin ekleneceği içeriği seçin.');
      return false;
    }
    if (!prompt.trim()) {
      setError('Görsel üretmek için bir istem (prompt) girin.');
      return false;
    }
    if (!altText.trim()) {
      setError('Alt metin zorunludur. Görseli açıklayan erişilebilir bir alt metin girin.');
      return false;
    }
    return true;
  }

  async function generate() {
    clearNotices();
    if (!validate()) return;
    setGenerating(true);
    try {
      const response = await fetch('/admin/api/studio/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', prompt: prompt.trim(), altText: altText.trim(), target: contentType, id: targetId }),
      });
      const data = await response.json().catch(() => null) as { image?: GeneratedImage } | null;
      if (!response.ok) throw new Error(serverMessage(data, 'Görsel üretilemedi.'));
      if (!data?.image?.imagePath) throw new Error('Sunucu geçerli bir görsel bilgisi döndürmedi.');
      setGenerated(data.image);
      setSuccess('Görsel hazır. Önizlemeyi kontrol edip ardından içeriğe ekleyin.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Görsel üretilemedi.');
    } finally {
      setGenerating(false);
    }
  }

  async function attach() {
    clearNotices();
    if (!generated) return;
    if (!altText.trim()) {
      setError('Alt metin zorunludur. Görseli eklemeden önce açıklayıcı bir alt metin girin.');
      return;
    }
    setAttaching(true);
    try {
      const response = await fetch('/admin/api/studio/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'attach', imagePath: generated.imagePath,
          altText: altText.trim(), target: contentType, id: targetId, placement,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(serverMessage(data, 'Görsel içeriğe eklenemedi.'));
      setSuccess(`Görsel ${placement === 'hero' ? 'kapak' : 'gövde'} alanına eklendi.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Görsel içeriğe eklenemedi.');
    } finally {
      setAttaching(false);
    }
  }

  const button = (primary = false, disabled = false): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
    padding: '10px 16px', border: primary ? 'none' : `1px solid ${C.border}`, borderRadius: '8px',
    background: primary ? C.gold : C.card, color: primary ? '#fff' : C.text, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 700, opacity: disabled ? 0.6 : 1,
  });

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <AdminPageHeader
        title="AI Görsel Üretimi"
        description="Görsel üretin, önizleyin ve seçtiğiniz içeriğe güvenle ekleyin."
        action={<Link href="/admin/ai-studio" style={{ textDecoration: 'none' }}><span style={button(false)}><ArrowLeft size={16} /> Stüdyoya Dön</span></Link>}
      />
      <main style={{ maxWidth: '1050px', margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 0.9fr)', gap: '20px', alignItems: 'start' }}>
          <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '22px 24px' }}>
            <h2 style={{ color: C.text, fontFamily: 'Inter, sans-serif', fontSize: '16px', margin: '0 0 20px' }}>Görsel ayarları</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '17px' }}>
              <div>
                <label htmlFor="content-type" style={labelStyle}>İçerik türü</label>
                <select id="content-type" value={contentType} onChange={event => { setContentType(event.target.value as ContentType); setGenerated(null); clearNotices(); }} style={fieldStyle}>
                  <option value="BLOG_POST">Blog yazısı</option>
                  <option value="SERVICE">Hizmet sayfası</option>
                </select>
              </div>
              <div>
                <label htmlFor="target" style={labelStyle}>Eklenecek kayıt</label>
                <select id="target" value={targetId} onChange={event => { setTargetId(event.target.value); setGenerated(null); clearNotices(); }} disabled={targetsLoading} style={fieldStyle}>
                  <option value="">{targetsLoading ? 'Kayıtlar yükleniyor…' : targets.length ? 'Bir kayıt seçin' : 'Kayıt bulunamadı'}</option>
                  {targets.map(target => <option key={target.id} value={target.id}>{target.title} ({target.slug})</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="placement" style={labelStyle}>Görsel konumu</label>
                <select id="placement" value={placement} onChange={event => setPlacement(event.target.value as Placement)} style={fieldStyle}>
                  <option value="hero">Kapak görseli (hero)</option>
                  <option value="body">İçerik gövdesi (body)</option>
                </select>
              </div>
              <div>
                <label htmlFor="prompt" style={labelStyle}>Görsel istemi (prompt)</label>
                <textarea id="prompt" value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Örn. İstanbul Havalimanı önünde modern, markasız VIP transfer aracı..." rows={5} style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.5 }} />
              </div>
              <div>
                <label htmlFor="alt-text" style={labelStyle}>Alt metin <span style={{ color: '#DC2626' }}>* Zorunlu</span></label>
                <input id="alt-text" value={altText} onChange={event => setAltText(event.target.value)} aria-required="true" aria-invalid={Boolean(error && !altText.trim())} placeholder="Görselin kısa ve anlamlı açıklaması" style={fieldStyle} />
                <p style={{ color: C.muted, fontFamily: 'Inter, sans-serif', fontSize: '12px', lineHeight: 1.5, margin: '7px 0 0' }}>
                  Alt metin, ekran okuyucu kullanan ziyaretçilere görseli açıklar ve arama motorlarının içeriği anlamasına yardımcı olur. Bu nedenle boş bırakılamaz.
                </p>
              </div>
              <button type="button" onClick={() => void generate()} disabled={generating || attaching} style={button(true, generating || attaching)}>
                {generating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : generated ? <RefreshCw size={16} /> : <Sparkles size={16} />}
                {generating ? 'Üretiliyor…' : generated ? 'Aynı istemle yeniden üret' : 'Görsel üret'}
              </button>
            </div>
          </section>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {error && <div role="alert" style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '9px', padding: '12px 14px', color: '#B91C1C', fontFamily: 'Inter, sans-serif', fontSize: '13px', display: 'flex', gap: '8px' }}><AlertTriangle size={17} style={{ flexShrink: 0 }} />{error}</div>}
            {success && <div role="status" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '9px', padding: '12px 14px', color: '#166534', fontFamily: 'Inter, sans-serif', fontSize: '13px', display: 'flex', gap: '8px' }}><CheckCircle2 size={17} style={{ flexShrink: 0 }} />{success}</div>}
            <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '18px' }}>
              <h2 style={{ color: C.text, fontFamily: 'Inter, sans-serif', fontSize: '15px', margin: '0 0 12px' }}>Önizleme</h2>
              {generated ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={generated.imagePath} alt={generated.altText} style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '8px', border: `1px solid ${C.border}` }} />
                  <div style={{ marginTop: '14px', display: 'grid', gap: '8px', fontFamily: 'Inter, sans-serif', fontSize: '12px', color: C.muted }}>
                    <div><strong style={{ color: C.text }}>Model:</strong> {generated.model}</div>
                    <div><strong style={{ color: C.text }}>Alt metin:</strong> {generated.altText}</div>
                    <div><strong style={{ color: C.text }}>İstem:</strong> {generated.prompt}</div>
                    <div style={{ overflowWrap: 'anywhere' }}><strong style={{ color: C.text }}>Nesne yolu:</strong> {generated.imagePath}</div>
                  </div>
                  <button type="button" onClick={() => void attach()} disabled={attaching || generating} style={{ ...button(true, attaching || generating), width: '100%', marginTop: '16px', background: C.navy }}>
                    {attaching ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
                    {attaching ? 'Ekleniyor…' : `${placement === 'hero' ? 'Kapak' : 'Gövde'} alanına ekle`}
                  </button>
                </>
              ) : (
                <div style={{ minHeight: '245px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '9px', color: C.light, fontFamily: 'Inter, sans-serif', fontSize: '13px', textAlign: 'center' }}>
                  <ImageIcon size={38} color={C.border} /> Görsel oluşturulduğunda burada önizleyebilirsiniz.
                </div>
              )}
            </section>
          </aside>
        </div>
      </main>
      <style>{'@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}