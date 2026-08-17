'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown, Pencil, Trash2, Plus, Loader2, Check, X, Languages } from 'lucide-react';
import AdminPageHeader from '@/app/admin/_components/AdminPageHeader';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Category {
  id: number;
  slug: string;
  nameTranslations: Record<string, string>;
  sortOrder: number;
  isActive: boolean;
  serviceCount: number;
}

const LOCALES = ['tr','en','de','ar','ru','es','fr','it','nl'];
const LOCALE_LABELS: Record<string,string> = {
  tr:'Türkçe', en:'English', de:'Deutsch', ar:'العربية',
  ru:'Русский', es:'Español', fr:'Français', it:'Italiano', nl:'Nederlands',
};

// ── Styles ────────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width:'100%', padding:'7px 10px', border:'1px solid #D1D5DB', borderRadius:'6px',
  fontSize:'13px', fontFamily:'Inter, sans-serif', color:'#1E293B',
  background:'#FFFFFF', outline:'none', boxSizing:'border-box',
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function KategorilerPage() {
  const [cats,        setCats]        = useState<Category[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [actionId,    setActionId]    = useState<number | null>(null);

  // ── New category form ────────────────────────────────────────────────────────
  const [newName,     setNewName]     = useState('');
  const [adding,      setAdding]      = useState(false);
  const [addError,    setAddError]    = useState('');

  // ── Inline edit ───────────────────────────────────────────────────────────────
  const [editId,      setEditId]      = useState<number | null>(null);
  const [editNames,   setEditNames]   = useState<Record<string,string>>({});
  const [saving,      setSaving]      = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res  = await fetch('/admin/api/categories');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Yüklenemedi.');
      setCats(data.categories ?? []);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Reorder ───────────────────────────────────────────────────────────────────

  async function reorder(id: number, direction: 'up' | 'down') {
    setActionId(id);
    try {
      const res  = await fetch(`/admin/api/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: direction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Hata.');
      setCats(data.categories ?? []);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setActionId(null);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  async function handleDelete(cat: Category) {
    if (confirmDelete !== cat.id) { setConfirmDelete(cat.id); return; }
    setConfirmDelete(null);
    setActionId(cat.id);
    try {
      const res  = await fetch(`/admin/api/categories/${cat.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Silinemedi.');
      setCats(prev => prev.filter(c => c.id !== cat.id));
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setActionId(null);
    }
  }

  // ── Inline edit ───────────────────────────────────────────────────────────────

  function startEdit(cat: Category) {
    setEditId(cat.id);
    setEditNames({ ...cat.nameTranslations });
    setConfirmDelete(null);
  }

  function cancelEdit() { setEditId(null); setEditNames({}); }

  async function saveEdit() {
    if (!editId) return;
    setSaving(true); setError('');
    try {
      const res  = await fetch(`/admin/api/categories/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', names: editNames }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Kaydedilemedi.');
      setCats(data.categories.map((c: Category) => ({
        ...c,
        serviceCount: cats.find(x => x.id === c.id)?.serviceCount ?? 0,
      })));
      setEditId(null); setEditNames({});
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  // ── Add new ───────────────────────────────────────────────────────────────────

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true); setAddError('');
    try {
      const res  = await fetch('/admin/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nameTr: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Eklenemedi.');
      setCats(prev => [...prev, data.category]);
      setNewName('');
    } catch (e: unknown) {
      setAddError(String(e));
    } finally {
      setAdding(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const totalServices = cats.reduce((s, c) => s + c.serviceCount, 0);

  return (
    <div style={{ padding: '28px 24px', maxWidth: '800px' }}>
      <AdminPageHeader
        title="Kategori Yönetimi"
        description={`Hizmetler sayfasındaki ${cats.length} kategori • ${totalServices} toplam hizmet`}
      />

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px',
          padding: '10px 14px', marginBottom: '16px', color: '#D64545',
          fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: '8px', cursor: 'pointer', background: 'none', border: 'none', color: '#D64545', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#718596', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Yükleniyor…
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '8px', marginBottom: '24px' }}>
          {cats.map((cat, idx) => (
            <div key={cat.id} style={{
              background: '#FFFFFF', border: '1px solid #E2E8F0',
              borderRadius: '10px', overflow: 'hidden',
            }}>
              {/* ── Summary row ─────────────────────────────────────── */}
              <div style={{
                display: 'grid', gridTemplateColumns: '38px 1fr 80px 90px auto',
                alignItems: 'center', gap: '12px', padding: '12px 16px',
              }}>
                {/* Sort order / up-down */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <button
                    onClick={() => reorder(cat.id, 'up')}
                    disabled={idx === 0 || actionId === cat.id}
                    title="Yukarı taşı"
                    style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.2 : 0.7, padding: '2px' }}
                  >
                    <ChevronUp size={16} />
                  </button>
                  <span style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{idx + 1}</span>
                  <button
                    onClick={() => reorder(cat.id, 'down')}
                    disabled={idx === cats.length - 1 || actionId === cat.id}
                    title="Aşağı taşı"
                    style={{ background: 'none', border: 'none', cursor: idx === cats.length - 1 ? 'default' : 'pointer', opacity: idx === cats.length - 1 ? 0.2 : 0.7, padding: '2px' }}
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>

                {/* Category info */}
                <div>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600, color: '#0F172A', margin: 0 }}>
                    {cat.nameTranslations['tr'] ?? cat.slug}
                  </p>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#94A3B8', margin: '2px 0 0' }}>
                    slug: {cat.slug}
                    {cat.nameTranslations['en'] && ` • EN: ${cat.nameTranslations['en']}`}
                  </p>
                </div>

                {/* Service count */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: cat.serviceCount > 0 ? '#EFF6FF' : '#F8FAFC',
                  color: cat.serviceCount > 0 ? '#1D4ED8' : '#94A3B8',
                  border: `1px solid ${cat.serviceCount > 0 ? '#BFDBFE' : '#E2E8F0'}`,
                  borderRadius: '20px', padding: '3px 10px',
                  fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
                  whiteSpace: 'nowrap',
                }}>
                  {cat.serviceCount} hizmet
                </span>

                {/* Lang coverage */}
                <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                  {LOCALES.map(loc => (
                    <span key={loc} title={LOCALE_LABELS[loc]} style={{
                      fontSize: '9px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px',
                      background: cat.nameTranslations[loc] ? '#DCFCE7' : '#F1F5F9',
                      color: cat.nameTranslations[loc] ? '#166534' : '#CBD5E1',
                      fontFamily: 'Inter, sans-serif',
                    }}>
                      {loc.toUpperCase()}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {editId === cat.id ? (
                    <>
                      <button onClick={saveEdit} disabled={saving}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', background: '#059669', color: '#FFF', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
                        {saving ? <Loader2 size={12} /> : <Check size={12} />} Kaydet
                      </button>
                      <button onClick={cancelEdit}
                        style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 8px', background: '#F1F5F9', color: '#374151', border: '1px solid #D1D5DB', borderRadius: '6px', cursor: 'pointer' }}>
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(cat)} title="Düzenle"
                        style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 8px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '6px', cursor: 'pointer' }}>
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(cat)}
                        disabled={cat.serviceCount > 0 || actionId === cat.id}
                        title={cat.serviceCount > 0 ? `${cat.serviceCount} hizmet içeriyor — önce hizmetleri taşıyın` : confirmDelete === cat.id ? 'Onaylamak için tekrar tıklayın' : 'Sil'}
                        style={{
                          display: 'inline-flex', alignItems: 'center', padding: '5px 8px',
                          background: cat.serviceCount > 0 ? '#F1F5F9' : confirmDelete === cat.id ? '#DC2626' : '#FEF2F2',
                          color:      cat.serviceCount > 0 ? '#CBD5E1' : confirmDelete === cat.id ? '#FFFFFF' : '#DC2626',
                          border:     `1px solid ${cat.serviceCount > 0 ? '#E2E8F0' : '#FECACA'}`,
                          borderRadius: '6px',
                          cursor: cat.serviceCount > 0 ? 'not-allowed' : 'pointer',
                        }}>
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* ── Inline edit panel ────────────────────────────────── */}
              {editId === cat.id && (
                <div style={{ borderTop: '1px solid #F1F5F9', padding: '16px', background: '#F8FAFC' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#52697A', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                    <Languages size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    Kategori Adı — Tüm Diller
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                    {LOCALES.map(loc => (
                      <div key={loc}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#52697A', fontFamily: 'Inter, sans-serif', display: 'block', marginBottom: '4px' }}>
                          {LOCALE_LABELS[loc]} ({loc.toUpperCase()})
                        </label>
                        <input
                          type="text"
                          value={editNames[loc] ?? ''}
                          onChange={e => setEditNames(p => ({ ...p, [loc]: e.target.value }))}
                          style={{ ...inp, direction: loc === 'ar' ? 'rtl' : 'ltr' }}
                          dir={loc === 'ar' ? 'rtl' : 'ltr'}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Add new category ──────────────────────────────────────────────── */}
      <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', padding: '20px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: '#52697A', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '14px' }}>
          Yeni Kategori Ekle
        </p>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Türkçe kategori adı…"
              style={{ ...inp }}
              disabled={adding}
            />
            {addError && (
              <p style={{ color: '#DC2626', fontSize: '12px', fontFamily: 'Inter, sans-serif', marginTop: '4px' }}>{addError}</p>
            )}
            <p style={{ color: '#94A3B8', fontSize: '11px', fontFamily: 'Inter, sans-serif', marginTop: '4px' }}>
              Türkçe ad girilirse 8 dile otomatik çevrilir. İngilizce, Almanca, Arapça, Rusça, İspanyolca, Fransızca, İtalyanca ve Hollandaca.
            </p>
          </div>
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px',
              background: adding ? '#93C5FD' : '#2563EB',
              color: '#FFFFFF', border: 'none',
              fontWeight: 700, fontSize: '13px', fontFamily: 'Inter, sans-serif',
              cursor: adding || !newName.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {adding ? <Loader2 size={14} /> : <Plus size={14} />}
            {adding ? 'Ekleniyor & Çevriliyor…' : 'Ekle'}
          </button>
        </form>
      </div>
    </div>
  );
}
