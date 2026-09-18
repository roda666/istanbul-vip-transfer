'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2, Check, X, Languages } from 'lucide-react';
import AdminPageHeader from '@/app/admin/_components/AdminPageHeader';
import { AdminRecordActions } from '@/app/admin/_components/AdminRecordActions';
import { AdminCmsRecordCard } from '@/app/admin/_components/AdminCmsRecordCard';
import { AdminActionButton } from '@/app/admin/_components/AdminActionButton';

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
  width:'100%', padding:'10px 14px', minHeight:'44px', border:'1px solid #D1D5DB', borderRadius:'8px',
  fontSize:'14px', fontFamily:'Inter, sans-serif', color:'#1E293B',
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
       setCats((current) => (data.categories ?? []).map((c: Category) => ({
         ...c,
         // GET returns the authoritative count. Mutation responses currently
         // omit it, so only preserve the existing value when the API did not
         // provide a count at all.
         serviceCount: typeof c.serviceCount === 'number'
           ? c.serviceCount
           : current.find(x => x.id === c.id)?.serviceCount ?? 0,
       })));
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
       setCats((data.categories ?? []).map((category: Category) => ({
         ...category,
         serviceCount: cats.find((current) => current.id === category.id)?.serviceCount ?? 0,
       })));
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setActionId(null);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  async function handleDelete(cat: Category) {
    if (!window.confirm(`"${cat.nameTranslations['tr'] ?? cat.slug}" kategorisini silmek istediğinize emin misiniz?`)) return;
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

  async function toggleActive(cat: Category) {
    setActionId(cat.id); setError('');
    try {
      const res = await fetch(`/admin/api/categories/${cat.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-active' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Durum değiştirilemedi.');
      setCats((data.categories ?? []).map((c: Category) => ({
        ...c, serviceCount: cats.find(x => x.id === c.id)?.serviceCount ?? 0,
      })));
    } catch (e: unknown) {
      setError(String(e));
    } finally { setActionId(null); }
  }

  // ── Inline edit ───────────────────────────────────────────────────────────────

  function startEdit(cat: Category) {
    setEditId(cat.id);
    setEditNames({ ...cat.nameTranslations });
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
            <AdminCmsRecordCard
              key={cat.id}
              title={cat.nameTranslations['tr'] ?? cat.slug}
              description={<>{`slug: ${cat.slug}`}{cat.nameTranslations['en'] && ` • EN: ${cat.nameTranslations['en']}`}<div className="mt-2">{cat.serviceCount} hizmet</div></>}
              status={<span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, color: cat.isActive ? '#166534' : '#B91C1C', background: cat.isActive ? '#DCFCE7' : '#FEE2E2' }}>
                {cat.isActive ? 'AKTİF' : 'DEVRE DIŞI'}
              </span>}
              languageStatuses={Object.fromEntries(
                Object.entries(cat.nameTranslations).map(([locale, value]) => [locale, value ? 'PUBLISHED' : 'DRAFT']),
              )}
            >
                <div data-admin-record-actions-row="true" style={{ display: 'flex', width: '100%', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto', justifyContent: 'flex-end' }}>
                  {editId === cat.id ? (
                    <>
                      <AdminActionButton label="Kaydet" icon={Check} variant="save" loading={saving} onClick={saveEdit} />
                      <AdminActionButton label="Vazgeç" icon={X} variant="cancel" manage={false} onClick={cancelEdit} />
                    </>
                  ) : (
                    <AdminRecordActions
                      up={{ onClick: () => reorder(cat.id, 'up'), disabled: idx === 0 || actionId === cat.id }}
                      down={{ onClick: () => reorder(cat.id, 'down'), disabled: idx === cats.length - 1 || actionId === cat.id }}
                      edit={{ onClick: () => startEdit(cat) }}
                      activation={{ onClick: () => toggleActive(cat), isActive: cat.isActive, disabled: actionId === cat.id }}
                      delete={{
                        onClick: () => handleDelete(cat),
                        disabled: cat.serviceCount > 0 || actionId === cat.id,
                        disabledReason: cat.serviceCount > 0 ? `${cat.serviceCount} hizmet içeriyor — önce hizmetleri taşıyın` : undefined
                      }}
                      deleteOmittedReason={cat.serviceCount > 0 ? `${cat.serviceCount} hizmet içeriyor` : undefined}
                    />
                  )}
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
            </AdminCmsRecordCard>
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
          <AdminActionButton type="submit" disabled={adding || !newName.trim()} loading={adding} label={adding ? 'Ekleniyor & Çevriliyor…' : 'Ekle'} icon={Plus} variant="new" />
        </form>
      </div>
    </div>
  );
}
