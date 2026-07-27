'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Check, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import AdminPageHeader from '../../_components/AdminPageHeader';

interface NavItem {
  id: string;
  label: string;
  href: string;
  location: 'HEADER' | 'FOOTER' | 'MOBILE';
  parentId: string | null;
  sortOrder: number;
  active: boolean;
}

const LOCATIONS = [
  { value: 'HEADER', label: 'Üst Menü' },
  { value: 'FOOTER', label: 'Alt Menü' },
  { value: 'MOBILE', label: 'Mobil Menü' },
];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', background: '#0F0F0F',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
  color: '#e5e5e5', fontSize: '13px', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
};

export default function MenuPage() {
  const [items, setItems] = useState<NavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [href, setHref] = useState('');
  const [location, setLocation] = useState<'HEADER' | 'FOOTER' | 'MOBILE'>('HEADER');
  const [parentId, setParentId] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/nav');
      const data = await res.json();
      setItems(data.items ?? []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function openCreate() {
    setEditId(null); setLabel(''); setHref(''); setLocation('HEADER');
    setParentId(''); setSortOrder(0); setActive(true); setFormError(''); setShowForm(true);
  }

  function openEdit(item: NavItem) {
    setEditId(item.id); setLabel(item.label); setHref(item.href); setLocation(item.location);
    setParentId(item.parentId ?? ''); setSortOrder(item.sortOrder); setActive(item.active);
    setFormError(''); setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFormError('');
    try {
      const url = editId ? `/api/admin/nav/${editId}` : '/api/admin/nav';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, href, location, parentId: parentId || null, sortOrder, active }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setFormError(data.error || 'Kaydedilemedi.'); return; }
      setShowForm(false); fetchItems();
    } catch { setFormError('Sunucu hatası.'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu menü öğesini silmek istediğinizden emin misiniz?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/nav/${id}`, { method: 'DELETE' });
      if (res.ok) fetchItems();
      else alert('Silme başarısız.');
    } catch { alert('Sunucu hatası.'); }
    finally { setDeleting(null); }
  }

  const groupedItems = LOCATIONS.map(loc => ({
    ...loc,
    items: items.filter(i => i.location === loc.value),
  }));

  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader title="Menü Yönetimi" description="Site navigasyon öğelerini yönetin"
        action={<button onClick={openCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: '#C9A84C', color: '#0A0A0A', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer' }}><Plus size={15} /> Yeni Öğe</button>}
      />

      {showForm && (
        <div style={{ background: '#161616', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ color: '#fff', fontSize: '14px', fontFamily: 'Inter, sans-serif', fontWeight: 600, margin: 0 }}>{editId ? 'Öğeyi Düzenle' : 'Yeni Menü Öğesi'}</h3>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={16} /></button>
          </div>
          {formError && <p style={{ color: '#f87171', fontSize: '12px', fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>{formError}</p>}
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, sans-serif', marginBottom: '5px' }}>Etiket *</label>
              <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} style={inputStyle} required />
            </div>
            <div>
              <label style={{ display: 'block', color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, sans-serif', marginBottom: '5px' }}>URL *</label>
              <input type="text" value={href} onChange={(e) => setHref(e.target.value)} style={inputStyle} required placeholder="/sayfa" />
            </div>
            <div>
              <label style={{ display: 'block', color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, sans-serif', marginBottom: '5px' }}>Konum</label>
              <select value={location} onChange={(e) => setLocation(e.target.value as typeof location)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {LOCATIONS.map(l => <option key={l.value} value={l.value} style={{ background: '#0F0F0F' }}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, sans-serif', marginBottom: '5px' }}>Üst Öğe</label>
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">—</option>
                {items.filter(i => i.id !== editId).map(i => <option key={i.id} value={i.id} style={{ background: '#0F0F0F' }}>{i.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, sans-serif', marginBottom: '5px' }}>Sıra</label>
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value))} style={{ ...inputStyle, width: '80px' }} min={0} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '20px' }}>
              <button type="button" onClick={() => setActive(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: active ? '#C9A84C' : '#555', padding: 0 }}>
                {active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
              </button>
              <span style={{ color: '#888', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>Aktif</span>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button type="submit" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: '#C9A84C', color: '#0A0A0A', fontWeight: 600, fontSize: '13px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? <Loader2 size={13} /> : <Check size={13} />} Kaydet
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', color: '#666', fontSize: '13px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>İptal</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#555', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>Yükleniyor...</p>
      ) : (
        groupedItems.map(group => (
          <div key={group.value} style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#888', fontSize: '11px', fontFamily: 'Inter, sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px' }}>{group.label}</h3>
            {group.items.length === 0 ? (
              <p style={{ color: '#333', fontSize: '12px', fontFamily: 'Inter, sans-serif', padding: '12px 0' }}>Bu konumda öğe yok.</p>
            ) : (
              <div style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden' }}>
                {group.items.map((item, i) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderBottom: i < group.items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.active ? '#4ade80' : '#555', flexShrink: 0 }} />
                    <span style={{ color: '#e5e5e5', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>{item.label}</span>
                    <span style={{ color: '#444', fontSize: '12px', fontFamily: 'monospace', flex: 1 }}>{item.href}</span>
                    <span style={{ color: '#333', fontSize: '11px', fontFamily: 'monospace' }}>#{item.sortOrder}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => openEdit(item)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '6px', background: 'rgba(201,168,76,0.1)', color: '#C9A84C', border: 'none', cursor: 'pointer' }}><Pencil size={13} /></button>
                      <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: 'none', cursor: 'pointer', opacity: deleting === item.id ? 0.5 : 1 }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
