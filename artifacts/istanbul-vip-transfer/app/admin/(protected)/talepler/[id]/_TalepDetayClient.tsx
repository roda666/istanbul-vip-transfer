'use client';

import { useState } from 'react';
import { Archive, MessageCircle, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Statuses available for new selections (workflow)
const WORKFLOW_STATUSES: Record<string, string> = {
  NEW:       'Yeni',
  CONTACTED: 'İletişimde',
  QUOTED:    'Teklife Gönderildi',
  CONFIRMED: 'Onaylandı',
  CANCELLED: 'İptal',
  ARCHIVED:  'Arşivlendi',
};

// Legacy statuses that may exist on old records — display-only
const LEGACY_STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Tamamlandı (Eski)',
  SPAM:      'Spam (Eski)',
};

interface Props {
  requestId:      string;
  currentStatus:  string;
  archivedAt:     string | null;
  customerName:   string;
  customerPhone:  string;
  referenceNumber: string;
  adminNotes:     string | null;
}

export default function TalepDetayClient({
  requestId,
  currentStatus,
  archivedAt,
  customerName,
  customerPhone,
  referenceNumber,
  adminNotes: initialNotes,
}: Props) {
  const [status, setStatus]   = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved]     = useState(false);
  const [notes, setNotes]     = useState(initialNotes ?? '');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved]   = useState(false);
  const router = useRouter();

  const isLegacy = status === 'COMPLETED' || status === 'SPAM';

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
    const phone   = customerPhone.replace(/\D/g, '');
    const intlPhone = phone.startsWith('0') ? `90${phone.slice(1)}` : phone.startsWith('90') ? phone : `90${phone}`;
    const message = encodeURIComponent(
      `Merhaba ${customerName}, IVT referans numaranız: ${referenceNumber} hakkında size ulaşmak istedik.`
    );
    window.open(`https://wa.me/${intlPhone}?text=${message}`, '_blank', 'noopener,noreferrer');
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
    color: '#94A3B8', display: 'block', marginBottom: '8px',
    fontFamily: 'Inter, sans-serif', letterSpacing: '0.08em',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

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
          <button
            onClick={archive}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px', border: '1px solid #E2E8F0',
              background: '#F8FAFC', color: '#64748B', fontSize: '12px',
              fontFamily: 'Inter, sans-serif', cursor: 'pointer',
            }}
          >
            <Archive size={13} /> Arşivle
          </button>
        </div>
      ) : (
        <p style={{ fontSize: '12px', color: '#94A3B8', fontFamily: 'Inter, sans-serif', margin: 0 }}>
          Bu talep arşivlenmiş.
        </p>
      )}

      {/* Internal notes */}
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
          <button
            onClick={saveNotes}
            disabled={notesSaving}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '8px',
              background: '#2563EB', color: '#FFFFFF',
              border: 'none', cursor: 'pointer',
              fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
            }}
          >
            <Save size={13} /> {notesSaving ? 'Kaydediliyor…' : 'Notu Kaydet'}
          </button>
          {notesSaved && (
            <span style={{ fontSize: '12px', color: '#15803D', fontFamily: 'Inter, sans-serif' }}>✓ Not kaydedildi</span>
          )}
        </div>
      </div>

    </div>
  );
}
