'use client';

/**
 * /admin/ai-oneriler/kumeler — Konu Kümeleri (Topic Clusters) CRUD UI
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Edit2, X, Check, LayoutGrid, RefreshCw } from 'lucide-react';
import AdminPageHeader from '../../../_components/AdminPageHeader';

interface Cluster {
  id: string;
  pillarSlug: string;
  pillarTitle: string;
  clusterArticles: Array<{ id: string; slug: string; title: string; publishedAt?: string | null }>;
  suggestedLinks: Array<{ from: string; to: string; anchor: string }>;
  createdAt: string;
  updatedAt: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', background: '#FFFFFF',
  border: '1px solid #D8E1E9', borderRadius: '8px',
  color: '#172B3A', fontSize: '13px', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', color: '#52697A', fontSize: '11px', fontFamily: 'Inter, sans-serif',
  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600,
};
const btn = (primary?: boolean, danger?: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
  fontFamily: 'Inter, sans-serif',
  border: danger ? '1px solid #FECACA' : primary ? 'none' : '1px solid #D8E1E9',
  background: danger ? '#FEF2F2' : primary ? '#2563EB' : '#F3F6FA',
  color: danger ? '#D64545' : primary ? '#FFFFFF' : '#172B3A', cursor: 'pointer',
});

function EmptyState() {
  return (
    <div style={{ background: '#FFFFFF', border: '1px dashed #D8E1E9', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
      <LayoutGrid size={28} style={{ color: '#C99A32', marginBottom: '14px' }} />
      <p style={{ color: '#172B3A', fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 600, margin: '0 0 6px' }}>Henüz konu kümesi yok</p>
      <p style={{ color: '#718596', fontFamily: 'Inter, sans-serif', fontSize: '13px', margin: 0 }}>
        İçerik stratejinizi cluster&apos;larla organize edin — her küme bir pillar sayfa ve bağlı makalelerden oluşur.
      </p>
    </div>
  );
}

export default function KumelerPage() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing]   = useState<string | null>(null);
  const [error, setError]       = useState('');

  // form state
  const [pillarSlug, setPillarSlug]   = useState('');
  const [pillarTitle, setPillarTitle] = useState('');

  // edit state
  const [editTitle, setEditTitle] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/admin/api/topic-clusters');
      const data = await res.json();
      setClusters(data.clusters ?? []);
    } catch { setClusters([]); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { fetchClusters(); }, [fetchClusters]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!pillarSlug.trim() || !pillarTitle.trim()) { setError('Slug ve başlık zorunludur.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/admin/api/topic-clusters', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pillarSlug: pillarSlug.trim(), pillarTitle: pillarTitle.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Kaydedilemedi.'); return; }
      setShowForm(false); setPillarSlug(''); setPillarTitle('');
      fetchClusters();
    } catch { setError('Sunucu hatası.'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu konu kümesini silmek istediğinizden emin misiniz?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/admin/api/topic-clusters/${id}`, { method: 'DELETE' });
      if (res.ok) fetchClusters();
    } catch { /* ignore */ }
    finally { setDeleting(null); }
  }

  function startEdit(c: Cluster) { setEditing(c.id); setEditTitle(c.pillarTitle); }
  function cancelEdit() { setEditing(null); setEditTitle(''); }

  async function saveEdit(id: string) {
    if (!editTitle.trim()) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/admin/api/topic-clusters/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pillarTitle: editTitle.trim() }),
      });
      if (res.ok) { setEditing(null); fetchClusters(); }
    } catch { /* ignore */ }
    finally { setEditSaving(false); }
  }

  return (
    <div style={{ padding: '28px 24px' }}>
      <Link href="/admin/ai-oneriler" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#52697A', fontSize: '12px', fontFamily: 'Inter, sans-serif', textDecoration: 'none', marginBottom: '16px' }}>
        <ArrowLeft size={13} /> AI İçerik Merkezi
      </Link>

      <AdminPageHeader
        title="Konu Kümeleri"
        description="Pillar sayfalar etrafında içerik grupları oluşturun ve AI önerilerini bağlayın"
        action={
          <button onClick={() => { setShowForm(v => !v); setError(''); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: '#2563EB', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            <Plus size={14} /> Yeni Küme
          </button>
        }
      />

      {/* Create form */}
      {showForm && (
        <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(23,43,58,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: '#172B3A', fontSize: '14px', fontFamily: 'Inter, sans-serif', fontWeight: 700, margin: 0 }}>Yeni Konu Kümesi</h3>
            <button onClick={() => { setShowForm(false); setError(''); }} style={{ background: 'none', border: 'none', color: '#718596', cursor: 'pointer' }}><X size={16} /></button>
          </div>
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px', marginBottom: '12px' }}>
              <p style={{ color: '#D64545', fontSize: '12px', fontFamily: 'Inter, sans-serif', margin: 0 }}>{error}</p>
            </div>
          )}
          <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Pillar Başlığı *</label>
              <input type="text" value={pillarTitle} onChange={e => setPillarTitle(e.target.value)} required
                style={inputStyle} placeholder="İstanbul Havalimanı Transfer Rehberi" />
            </div>
            <div>
              <label style={labelStyle}>Pillar Slug *</label>
              <input type="text" value={pillarSlug} onChange={e => setPillarSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))} required
                style={inputStyle} placeholder="istanbul-havalimani-transfer" />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px' }}>
              <button type="submit" disabled={saving} style={btn(true)}>
                {saving ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={12} />}
                {saving ? 'Kaydediliyor...' : 'Oluştur'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setError(''); }} style={btn()}>İptal</button>
            </div>
          </form>
        </div>
      )}

      {/* Cluster list */}
      {loading ? (
        <p style={{ color: '#718596', fontFamily: 'Inter, sans-serif', fontSize: '13px', textAlign: 'center', padding: '40px' }}>Yükleniyor...</p>
      ) : clusters.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {clusters.map(c => (
            <div key={c.id} style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', borderBottom: '1px solid #E8EDF2', background: '#F8FAFC' }}>
                <LayoutGrid size={15} style={{ color: '#C99A32', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editing === c.id ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                        style={{ ...inputStyle, flex: 1 }} autoFocus />
                      <button onClick={() => saveEdit(c.id)} disabled={editSaving} style={btn(true)}>
                        {editSaving ? <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={11} />}
                      </button>
                      <button onClick={cancelEdit} style={btn()}>
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#172B3A', fontFamily: 'Inter, sans-serif', margin: '0 0 2px' }}>{c.pillarTitle}</p>
                      <code style={{ fontSize: '10px', color: '#52697A', fontFamily: 'monospace' }}>/{c.pillarSlug}</code>
                    </>
                  )}
                </div>
                {editing !== c.id && (
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => startEdit(c)} title="Düzenle" style={{ ...btn(), padding: '5px 8px' }}>
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id} title="Sil"
                      style={{ ...btn(false, true), padding: '5px 8px', opacity: deleting === c.id ? 0.5 : 1 }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* Body */}
              <div style={{ padding: '14px 18px' }}>
                <p style={{ fontSize: '11px', color: '#52697A', fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', margin: '0 0 8px' }}>
                  Kümedeki Makaleler ({c.clusterArticles.length})
                </p>
                {c.clusterArticles.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#A0B0BC', fontFamily: 'Inter, sans-serif', margin: 0 }}>
                    Henüz makale eklenmemiş — AI öneri detay sayfasından bu kümeye bağlayabilirsiniz.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {c.clusterArticles.map(a => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#F8FAFC', borderRadius: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '12px', color: '#172B3A', fontFamily: 'Inter, sans-serif', fontWeight: 500, margin: '0 0 2px' }}>{a.title}</p>
                          <code style={{ fontSize: '10px', color: '#718596' }}>{a.slug}</code>
                        </div>
                        {a.publishedAt && (
                          <span style={{ fontSize: '10px', color: '#168C5B', fontFamily: 'Inter, sans-serif' }}>Yayında</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
