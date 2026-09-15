'use client';

import { useState } from 'react';
import { Archive, MessageCircle, Save, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { openWhatsAppChat } from '@/lib/whatsapp';
import { AdminActionButton } from '../../../_components/AdminActionButton';

// Statuses available for new selections (workflow)
const WORKFLOW_STATUSES: Record<string, string> = {
  NEW:       'Yeni',
  CONTACTED: 'İletişimde',
  QUOTED:    'Teklife Gönderildi',
  CONFIRMED: 'Onaylandı',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
  ARCHIVED:  'Arşivlendi',
};

// Legacy statuses that may exist on old records — display-only
const LEGACY_STATUS_LABELS: Record<string, string> = {
  SPAM: 'Spam (Eski)',
};

interface Props {
  requestId:       string;
  currentStatus:   string;
  archivedAt:      string | null;
  customerName:    string;
  customerPhone:   string;
  referenceNumber: string;
  adminNotes:      string | null;
  /** Direct Google review link fetched from site_settings */
  googleReviewUrl: string;
  isTestData:      boolean;
}

export default function TalepDetayClient({
  requestId,
  currentStatus,
  archivedAt,
  customerName,
  customerPhone,
  referenceNumber,
  adminNotes: initialNotes,
  googleReviewUrl,
  isTestData: initialIsTestData,
}: Props) {
  const [status, setStatus]   = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved]     = useState(false);
  const [notes, setNotes]     = useState(initialNotes ?? '');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved]   = useState(false);
  const [copyDone, setCopyDone]       = useState(false);
  const [isTestData, setIsTestData]   = useState(initialIsTestData);
  const [testDataSaving, setTestDataSaving] = useState(false);
  const [conversion, setConversion] = useState(false);
  const [conversionData, setConversionData] = useState({ plannedPickupAt: '', pickupLocationSummary: '', dropoffLocationSummary: '', routeSummary: '', customerSummary: customerName });
  const [conversionSaving, setConversionSaving] = useState(false);
  const router = useRouter();

  const isLegacy = status === 'SPAM';
  const reviewLink = googleReviewUrl.trim();

  async function saveStatus(newStatus: string) {
    setLoading(true);
    setSaved(false);
    try {
      await fetch(`/admin/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setStatus(newStatus);
      setSaved(true);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function saveNotes() {
    setNotesSaving(true);
    setNotesSaved(false);
    try {
      await fetch(`/admin/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      setNotesSaved(true);
    } finally {
      setNotesSaving(false);
    }
  }

  async function toggleTestData() {
    const next = !isTestData;
    setTestDataSaving(true);
    try {
      await fetch(`/admin/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTestData: next }),
      });
      setIsTestData(next);
      router.refresh();
    } finally {
      setTestDataSaving(false);
    }
  }

  async function archive() {
    if (!confirm('Bu talebi arşivlemek istediğinize emin misiniz?')) return;
    setLoading(true);
    try {
      await fetch(`/admin/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive: true }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function openWhatsApp() {
    const message = `Merhaba ${customerName}, IVT referans numaranız: ${referenceNumber} hakkında size ulaşmak istedik.`;
    openWhatsAppChat(customerPhone, message);
  }

  async function convertToTransfer(e: React.FormEvent) {
    e.preventDefault(); setConversionSaving(true);
    try {
      const response = await fetch(`/admin/api/requests/${requestId}/convert-to-transfer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...conversionData, plannedPickupAt: new Date(conversionData.plannedPickupAt).toISOString() }) });
      if (!response.ok) throw new Error((await response.json()).error ?? 'Dönüştürme başarısız.');
      setConversion(false); setSaved(true); router.refresh();
    } catch (error) { setSaved(false); alert(error instanceof Error ? error.message : 'Dönüştürme başarısız.'); } finally { setConversionSaving(false); }
  }

  /** Builds the WhatsApp review-request message and opens it */
  function openReviewWhatsApp() {
    if (!reviewLink) return;
    const message = `Merhaba ${customerName} 😊\n\nTransfer hizmetimizden memnun kaldıysanız, Google'da kısa bir yorum bırakmanız bize çok yardımcı olur 🙏\n\n⭐ Yorum bağlantısı: ${reviewLink}\n\nTeşekkürler!\nİstanbul VIP Transfer`;
    openWhatsAppChat(customerPhone, message);
  }

  /** Copies the review message text to clipboard */
  function copyReviewMessage() {
    if (!reviewLink) return;
    const text = `Merhaba ${customerName} 😊\n\nTransfer hizmetimizden memnun kaldıysanız, Google'da kısa bir yorum bırakmanız bize çok yardımcı olur 🙏\n\n⭐ Yorum bağlantısı: ${reviewLink}\n\nTeşekkürler!\nİstanbul VIP Transfer`;
    navigator.clipboard.writeText(text).then(() => {
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2500);
    }).catch(() => {});
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
    color: '#94A3B8', display: 'block', marginBottom: '8px',
    fontFamily: 'Inter, sans-serif', letterSpacing: '0.08em',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Test data flag */}
      <div>
        <label style={labelStyle}>Test Verisi</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {isTestData && (
            <span style={{
              padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.04em',
              background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A',
            }}>
              Test Verisi
            </span>
          )}
          <AdminActionButton onClick={toggleTestData} disabled={testDataSaving} loading={testDataSaving} label={testDataSaving ? 'Kaydediliyor…' : isTestData ? 'Test İşaretini Kaldır' : 'Test Verisi Olarak İşaretle'} variant="subtle" />
        </div>
        <p style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'Inter, sans-serif', margin: '8px 0 0' }}>
          Bu talep gerçek bir müşteri talebi değil, geliştirme/test amaçlı gönderilmiş görünüyorsa işaretleyin. Kayıt silinmez, yalnızca listelerde ayrıştırılır.
        </p>
      </div>

      {/* Status section */}
      <div>
        <label style={labelStyle}>Durum</label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {isLegacy ? (
            <span style={{
              padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB',
              fontSize: '13px', fontFamily: 'Inter, sans-serif', background: '#F8FAFC', color: '#64748B',
              display: 'inline-block',
            }}>
              {LEGACY_STATUS_LABELS[status] ?? status}
            </span>
          ) : (
            <select
              value={status}
              disabled={loading || !!archivedAt}
              onChange={(e) => saveStatus(e.target.value)}
              style={{
                padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB',
                fontSize: '13px', fontFamily: 'Inter, sans-serif', background: '#FFFFFF', cursor: 'pointer',
              }}
            >
              {Object.entries(WORKFLOW_STATUSES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          )}
          {saved && <span style={{ fontSize: '12px', color: '#15803D', fontFamily: 'Inter, sans-serif' }}>✓ Kaydedildi</span>}
        </div>
      </div>

      {/* WhatsApp contact button */}
      <div>
        <label style={labelStyle}>Müşteri İle İletişim</label>
        <button
          onClick={openWhatsApp}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '9px 16px', borderRadius: '8px',
            background: '#25D366', color: '#FFFFFF',
            border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
          }}
        >
          <MessageCircle size={15} />
          WhatsApp&apos;tan Ulaş
        </button>
      </div>

      {/* Archive / archived indicator */}
      {!archivedAt ? (
        <div>
          <AdminActionButton onClick={archive} disabled={loading} loading={loading} label="Arşivle" icon={Archive} variant="archive" />
        </div>
      ) : (
        <p style={{ fontSize: '12px', color: '#94A3B8', fontFamily: 'Inter, sans-serif', margin: 0 }}>
          Bu talep arşivlenmiş.
        </p>
      )}

      {/* ── Review request panel — shown when status is COMPLETED ── */}
      {status === 'COMPLETED' && (
        <div style={{
          background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF9EE 100%)',
          border: '1px solid #FDE68A',
          borderRadius: '10px',
          padding: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
            <Star size={15} style={{ color: '#D97706', fill: '#D97706' }} />
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#92400E', fontFamily: 'Inter, sans-serif', margin: 0 }}>
              Yorum İsteği Gönder
            </p>
          </div>
          <p style={{ fontSize: '12px', color: '#B45309', fontFamily: 'Inter, sans-serif', margin: '0 0 12px', lineHeight: 1.5 }}>
            Müşteriye hazır mesajı WhatsApp üzerinden gönderin veya kopyalayıp kendi mesajınıza yapıştırın.
            Gönderim tamamen manuel — admin WhatsApp&apos;ından yapılır.
          </p>

          {/* Preview of the message */}
          <div style={{
            background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px',
            padding: '12px', marginBottom: '12px', fontSize: '12px', color: '#374151',
            fontFamily: 'Inter, sans-serif', lineHeight: 1.6, whiteSpace: 'pre-line',
          }}>
            {`Merhaba ${customerName} 😊\n\nTransfer hizmetimizden memnun kaldıysanız, Google'da kısa bir yorum bırakmanız bize çok yardımcı olur 🙏\n\n⭐ Yorum bağlantısı: ${reviewLink || '(Google Yorum URL\'si ayarlardan girilmeli)'}\n\nTeşekkürler!\nİstanbul VIP Transfer`}
          </div>

          {!reviewLink && (
            <p style={{ fontSize: '11px', color: '#DC2626', fontFamily: 'Inter, sans-serif', margin: '0 0 10px', background: '#FEF2F2', padding: '6px 10px', borderRadius: '6px', border: '1px solid #FECACA' }}>
              ⚠️ Google Yorum URL&apos;si henüz girilmemiş. Lütfen <strong>Site Ayarları</strong> sayfasından ekleyin.
            </p>
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={openReviewWhatsApp}
              disabled={!reviewLink}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '8px',
                background: reviewLink ? '#25D366' : '#86D9A5', color: '#FFFFFF',
                border: 'none', cursor: reviewLink ? 'pointer' : 'not-allowed',
                fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
              }}
            >
              <MessageCircle size={13} />
              WhatsApp&apos;tan Gönder
            </button>
            <button
              onClick={copyReviewMessage}
              disabled={!reviewLink}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '8px',
                background: '#F1F5F9', color: reviewLink ? '#475569' : '#94A3B8',
                border: '1px solid #E2E8F0', cursor: reviewLink ? 'pointer' : 'not-allowed',
                fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
              }}
            >
              {copyDone ? '✓ Kopyalandı' : 'Metni Kopyala'}
            </button>
          </div>
        </div>
      )}

      {/* Internal notes */}
      {status !== 'COMPLETED' && status !== 'CANCELLED' && !archivedAt && (
        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 16 }}>
          <AdminActionButton type="button" onClick={() => setConversion(!conversion)} label="Transfer operasyonuna dönüştür" variant="new" manage={false} />
          {conversion && <form onSubmit={convertToTransfer} style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            <label>Planlanan alış zamanı<input required type="datetime-local" value={conversionData.plannedPickupAt} onChange={e => setConversionData({ ...conversionData, plannedPickupAt: e.target.value })} /></label>
            {(['pickupLocationSummary', 'dropoffLocationSummary', 'routeSummary', 'customerSummary'] as const).map(key => <label key={key}>{key === 'pickupLocationSummary' ? 'Alış konumu' : key === 'dropoffLocationSummary' ? 'Varış konumu' : key === 'routeSummary' ? 'Rota özeti' : 'Müşteri özeti'}<input required value={conversionData[key]} onChange={e => setConversionData({ ...conversionData, [key]: e.target.value })} /></label>)}
            <AdminActionButton type="submit" disabled={conversionSaving} loading={conversionSaving} label={conversionSaving ? 'Dönüştürülüyor…' : 'Transfer oluştur'} variant="save" />
          </form>}
        </div>
      )}
      <div>
        <label style={labelStyle}>İç Notlar (yalnızca admin görür)</label>
        <textarea
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setNotesSaved(false); }}
          rows={4}
          maxLength={4000}
          placeholder="Bu talep hakkında dahili notlarınızı buraya yazın…"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: '8px',
            border: '1px solid #D1D5DB', fontSize: '13px',
            fontFamily: 'Inter, sans-serif', color: '#1E293B',
            resize: 'vertical', boxSizing: 'border-box',
            background: '#FAFAFA',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
          <AdminActionButton onClick={saveNotes} disabled={notesSaving} loading={notesSaving} label={notesSaving ? 'Kaydediliyor…' : 'Notu Kaydet'} icon={Save} variant="save" />
          {notesSaved && (
            <span style={{ fontSize: '12px', color: '#15803D', fontFamily: 'Inter, sans-serif' }}>✓ Not kaydedildi</span>
          )}
        </div>
      </div>

    </div>
  );
}
