'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle, Globe, Archive, Save, Loader2 } from 'lucide-react';
import { STATUS_LABELS, type ContentStatus } from '@/lib/workflow';

type ContentType = 'PAGE' | 'SERVICE' | 'BLOG_POST';

interface ContentDto {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string | null;
  heroImage: string | null;
  heroImageAlt: string | null;
  status: ContentStatus;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  indexable: boolean;
  scheduledAt: string | null; // ISO string
  approvedAt: string | null;
  approvedBy: string | null;
  publishedAt: string | null;
}

interface Props {
  mode: 'create' | 'edit';
  contentType: ContentType;
  initialData?: ContentDto;
  backUrl: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function toIstanbulDatetimeLocal(isoString: string | null): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    // Format as datetime-local in Istanbul time
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).format(d).replace(' ', 'T').slice(0, 16);
  } catch {
    return '';
  }
}

export default function ContentForm({ mode, contentType, initialData, backUrl }: Props) {
  const router = useRouter();
  const isEdit = mode === 'edit';

  const [title, setTitle] = useState(initialData?.title ?? '');
  const [slug, setSlug] = useState(initialData?.slug ?? '');
  const [slugManual, setSlugManual] = useState(isEdit);
  const [excerpt, setExcerpt] = useState(initialData?.excerpt ?? '');
  const [body, setBody] = useState(initialData?.body ?? '');
  const [heroImage, setHeroImage] = useState(initialData?.heroImage ?? '');
  const [heroImageAlt, setHeroImageAlt] = useState(initialData?.heroImageAlt ?? '');
  const [status, setStatus] = useState<ContentStatus>(initialData?.status ?? 'DRAFT');
  const [seoTitle, setSeoTitle] = useState(initialData?.seoTitle ?? '');
  const [seoDescription, setSeoDescription] = useState(initialData?.seoDescription ?? '');
  const [canonicalUrl, setCanonicalUrl] = useState(initialData?.canonicalUrl ?? '');
  const [indexable, setIndexable] = useState(initialData?.indexable ?? true);
  const [scheduledAt, setScheduledAt] = useState(
    toIstanbulDatetimeLocal(initialData?.scheduledAt ?? null)
  );

  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const needsApprovalReset =
    isEdit && (initialData?.status === 'APPROVED' || initialData?.status === 'SCHEDULED');

  const handleTitleChange = useCallback(
    (val: string) => {
      setTitle(val);
      if (!slugManual) setSlug(slugify(val));
    },
    [slugManual],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      contentType,
      title: title.trim(),
      slug: slug.trim(),
      excerpt: excerpt.trim() || null,
      body: body.trim() || null,
      heroImage: heroImage.trim() || null,
      heroImageAlt: heroImageAlt.trim() || null,
      status,
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      canonicalUrl: canonicalUrl.trim() || null,
      indexable,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    };

    try {
      const url = isEdit ? `/api/admin/content/${initialData!.id}` : '/api/admin/content';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Kaydedilemedi. Lütfen tekrar deneyin.');
      } else {
        if (isEdit) {
          setSuccess('Kaydedildi.');
          router.refresh();
        } else {
          router.push(backUrl);
          router.refresh();
        }
      }
    } catch {
      setError('Sunucu hatası. Lütfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(action: 'approve' | 'publish' | 'archive') {
    if (!isEdit) return;
    setActionLoading(action);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/admin/content/${initialData!.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'İşlem başarısız.');
      } else {
        setSuccess(
          action === 'approve'
            ? 'İçerik onaylandı.'
            : action === 'publish'
            ? 'İçerik yayınlandı.'
            : 'İçerik arşivlendi.',
        );
        router.refresh();
      }
    } catch {
      setError('Sunucu hatası.');
    } finally {
      setActionLoading(null);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    background: '#0F0F0F',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#e5e5e5',
    fontSize: '13px',
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    color: '#888',
    fontSize: '11px',
    fontFamily: 'Inter, sans-serif',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '6px',
  };

  const sectionStyle: React.CSSProperties = {
    background: '#161616',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
  };

  const sectionTitle: React.CSSProperties = {
    color: '#888',
    fontSize: '11px',
    fontFamily: 'Inter, sans-serif',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginBottom: '16px',
    paddingBottom: '10px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '860px' }}>
      {/* Approval reset warning */}
      {needsApprovalReset && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.3)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '16px',
          }}
        >
          <AlertTriangle size={16} style={{ color: '#fbbf24', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ color: '#fbbf24', fontSize: '13px', fontFamily: 'Inter, sans-serif', margin: 0 }}>
            Bu içerik{' '}
            <strong>{STATUS_LABELS[initialData!.status as ContentStatus]}</strong> durumunda.
            Değişiklik kaydedildiğinde onay sıfırlanacak ve İnceleme durumuna geçecektir.
          </p>
        </div>
      )}

      {/* Feedback */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#f87171', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#86efac', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
          {success}
        </div>
      )}

      {/* Basic info */}
      <div style={sectionStyle}>
        <p style={sectionTitle}>Temel Bilgiler</p>
        <div style={{ display: 'grid', gap: '14px' }}>
          <div>
            <label style={labelStyle} htmlFor="title">Başlık *</label>
            <input id="title" type="text" required value={title} onChange={(e) => handleTitleChange(e.target.value)} style={inputStyle} placeholder="İçerik başlığı" maxLength={200} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="slug">Slug *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#444', fontSize: '13px', fontFamily: 'monospace', flexShrink: 0 }}>/</span>
              <input
                id="slug"
                type="text"
                required
                value={slug}
                onChange={(e) => { setSlugManual(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); }}
                style={{ ...inputStyle, fontFamily: 'monospace' }}
                placeholder="url-dostu-slug"
                maxLength={200}
                pattern="[a-z0-9-]+"
                title="Yalnızca küçük harf, rakam ve tire"
              />
            </div>
          </div>
          <div>
            <label style={labelStyle} htmlFor="excerpt">Özet</label>
            <textarea id="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' }} placeholder="Kısa açıklama (liste sayfalarında gösterilir)" maxLength={500} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={sectionStyle}>
        <p style={sectionTitle}>İçerik</p>
        <div>
          <label style={labelStyle} htmlFor="body">Gövde</label>
          <p style={{ color: '#444', fontSize: '11px', fontFamily: 'Inter, sans-serif', marginBottom: '8px' }}>
            Desteklenen: ## Başlık, ### Alt başlık, - Liste, **kalın**, [bağlantı](url)
          </p>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={{ ...inputStyle, minHeight: '280px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
            placeholder="İçerik metnini buraya girin..."
          />
        </div>
      </div>

      {/* Media */}
      <div style={sectionStyle}>
        <p style={sectionTitle}>Medya</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div>
            <label style={labelStyle} htmlFor="heroImage">Hero Görsel Yolu</label>
            <input id="heroImage" type="text" value={heroImage} onChange={(e) => setHeroImage(e.target.value)} style={inputStyle} placeholder="/images/ornek.jpg" maxLength={500} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="heroImageAlt">Hero Görsel Alt Metni</label>
            <input id="heroImageAlt" type="text" value={heroImageAlt} onChange={(e) => setHeroImageAlt(e.target.value)} style={inputStyle} placeholder="Görseli tanımlayan metin" maxLength={200} />
          </div>
        </div>
      </div>

      {/* SEO */}
      <div style={sectionStyle}>
        <p style={sectionTitle}>SEO</p>
        <div style={{ display: 'grid', gap: '14px' }}>
          <div>
            <label style={labelStyle} htmlFor="seoTitle">Meta Başlık</label>
            <input id="seoTitle" type="text" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} style={inputStyle} placeholder="Sayfa başlığı (max 60 karakter ideal)" maxLength={200} />
            <p style={{ color: '#444', fontSize: '11px', fontFamily: 'Inter, sans-serif', marginTop: '4px' }}>{seoTitle.length}/200</p>
          </div>
          <div>
            <label style={labelStyle} htmlFor="seoDescription">Meta Açıklama</label>
            <textarea id="seoDescription" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' }} placeholder="Arama sonuçlarında görünen açıklama (max 160 karakter ideal)" maxLength={400} />
            <p style={{ color: '#444', fontSize: '11px', fontFamily: 'Inter, sans-serif', marginTop: '4px' }}>{seoDescription.length}/400</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '14px', alignItems: 'end' }}>
            <div>
              <label style={labelStyle} htmlFor="canonicalUrl">Canonical URL</label>
              <input id="canonicalUrl" type="text" value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} style={inputStyle} placeholder="https://www.istanbulviptransfer.com/..." maxLength={500} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', paddingBottom: '10px' }}>
              <input
                type="checkbox"
                checked={indexable}
                onChange={(e) => setIndexable(e.target.checked)}
                style={{ width: '14px', height: '14px', accentColor: '#C9A84C' }}
              />
              <span style={{ color: '#888', fontSize: '12px', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
                Dizine eklensin
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Publishing */}
      <div style={sectionStyle}>
        <p style={sectionTitle}>Yayın</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div>
            <label style={labelStyle} htmlFor="status">Durum</label>
            {/* APPROVED and PUBLISHED are only reachable via action buttons — not the dropdown */}
            <select
              id="status"
              value={(['APPROVED', 'PUBLISHED'] as ContentStatus[]).includes(status) ? status : status}
              onChange={(e) => setStatus(e.target.value as ContentStatus)}
              style={{ ...inputStyle, cursor: 'pointer' }}
              disabled={(['APPROVED', 'PUBLISHED'] as ContentStatus[]).includes(status)}
              title={(['APPROVED', 'PUBLISHED'] as ContentStatus[]).includes(status) ? 'Bu durum yalnızca Onayla / Yayınla butonlarıyla değiştirilebilir.' : undefined}
            >
              {/* Freely selectable statuses */}
              {(['DRAFT', 'RESEARCH', 'REVIEW', 'ARCHIVED'] as ContentStatus[]).map((s) => (
                <option key={s} value={s} style={{ background: '#0F0F0F' }}>{STATUS_LABELS[s]}</option>
              ))}
              {/* SCHEDULED is selectable in edit mode only when current status is APPROVED */}
              {isEdit && initialData?.status === 'APPROVED' && (
                <option value="SCHEDULED" style={{ background: '#0F0F0F' }}>{STATUS_LABELS['SCHEDULED']}</option>
              )}
              {/* Show current terminal state as read-only option so the select isn't blank */}
              {(['APPROVED', 'PUBLISHED'] as ContentStatus[]).includes(status) && (
                <option value={status} style={{ background: '#0F0F0F' }}>{STATUS_LABELS[status]}</option>
              )}
            </select>
            {(['APPROVED', 'PUBLISHED'] as ContentStatus[]).includes(status) && (
              <p style={{ color: '#555', fontSize: '11px', fontFamily: 'Inter, sans-serif', marginTop: '4px' }}>
                Bu durum yalnızca Onayla / Yayınla / Arşivle butonlarıyla değiştirilebilir.
              </p>
            )}
          </div>
          <div>
            <label style={labelStyle} htmlFor="scheduledAt">
              Yayın Tarihi (İstanbul Saati, UTC+3)
            </label>
            <input
              id="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              style={{ ...inputStyle, colorScheme: 'dark' }}
            />
          </div>
        </div>

        {/* Approval info in edit mode */}
        {isEdit && initialData?.approvedAt && (
          <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(34,197,94,0.05)', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.15)' }}>
            <p style={{ color: '#86efac', fontSize: '12px', fontFamily: 'Inter, sans-serif', margin: 0 }}>
              ✓ Onaylandı: {new Date(initialData.approvedAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}
            </p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '10px 20px',
            borderRadius: '8px',
            background: saving ? 'rgba(201,168,76,0.5)' : '#C9A84C',
            color: '#0A0A0A',
            fontWeight: 700,
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>

        {/* Approve button (available for DRAFT/RESEARCH/REVIEW) */}
        {isEdit && ['DRAFT', 'RESEARCH', 'REVIEW'].includes(initialData?.status ?? '') && (
          <button
            type="button"
            onClick={() => handleAction('approve')}
            disabled={actionLoading === 'approve'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '10px 20px',
              borderRadius: '8px',
              background: 'rgba(34,197,94,0.15)',
              color: '#86efac',
              border: '1px solid rgba(34,197,94,0.3)',
              fontWeight: 600,
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
              cursor: actionLoading === 'approve' ? 'not-allowed' : 'pointer',
              opacity: actionLoading === 'approve' ? 0.5 : 1,
            }}
          >
            <CheckCircle size={14} />
            {actionLoading === 'approve' ? 'Onaylanıyor...' : 'Onayla'}
          </button>
        )}

        {/* Publish button (available for APPROVED) */}
        {isEdit && initialData?.status === 'APPROVED' && (
          <button
            type="button"
            onClick={() => handleAction('publish')}
            disabled={actionLoading === 'publish'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '10px 20px',
              borderRadius: '8px',
              background: 'rgba(59,130,246,0.15)',
              color: '#93c5fd',
              border: '1px solid rgba(59,130,246,0.3)',
              fontWeight: 600,
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
              cursor: actionLoading === 'publish' ? 'not-allowed' : 'pointer',
              opacity: actionLoading === 'publish' ? 0.5 : 1,
            }}
          >
            <Globe size={14} />
            {actionLoading === 'publish' ? 'Yayınlanıyor...' : 'Yayınla'}
          </button>
        )}

        {/* Archive button (available for PUBLISHED/APPROVED) */}
        {isEdit && ['PUBLISHED', 'APPROVED', 'SCHEDULED'].includes(initialData?.status ?? '') && (
          <button
            type="button"
            onClick={() => handleAction('archive')}
            disabled={actionLoading === 'archive'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '10px 20px',
              borderRadius: '8px',
              background: 'rgba(239,68,68,0.1)',
              color: '#f87171',
              border: '1px solid rgba(239,68,68,0.2)',
              fontWeight: 600,
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
              cursor: actionLoading === 'archive' ? 'not-allowed' : 'pointer',
              opacity: actionLoading === 'archive' ? 0.5 : 1,
            }}
          >
            <Archive size={14} />
            {actionLoading === 'archive' ? 'Arşivleniyor...' : 'Arşivle'}
          </button>
        )}
      </div>
    </form>
  );
}
