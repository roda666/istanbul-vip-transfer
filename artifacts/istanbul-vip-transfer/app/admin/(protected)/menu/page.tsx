'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Check, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import AdminPageHeader from '../../_components/AdminPageHeader';
import { AdminRecordActions } from '../../_components/AdminRecordActions';
import { AdminActionButton } from '../../_components/AdminActionButton';

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
  width: '100%', padding: '10px 14px', minHeight: '44px', background: '#FFFFFF',
  border: '1px solid #D8E1E9', borderRadius: '8px',
  color: '#172B3A', fontSize: '14px', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', color: '#52697A', fontSize: '11px', textTransform: 'uppercase',
  letterSpacing: '0.08em', fontFamily: 'Inter, sans-serif', marginBottom: '5px', fontWeight: 600,
};

export default function MenuPage() {
  const [items, setItems] = useState<NavItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
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
    setLoadError(null);
    setItems(null);
    try {
      const res = await fetch('/admin/api/nav');
      const isJson = res.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await res.json().catch(() => null) : null;
      if (!res.ok) throw new Error(data?.error ?? 'Menü öğeleri yüklenemedi.');
      setItems(data?.items ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Menü öğeleri yüklenemedi.');
    }
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
      const url = editId ? `/admin/api/nav/${editId}` : '/admin/api/nav';
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
      const res = await fetch(`/admin/api/nav/${id}`, { method: 'DELETE' });
      if (res.ok) fetchItems();
      else alert('Silme başarısız.');
    } catch { alert('Sunucu hatası.'); }
    finally { setDeleting(null); }
  }

  async function moveItem(item: NavItem, direction: 'up' | 'down') {
    const siblings = (items ?? []).filter(i => i.location === item.location);
    const index = siblings.findIndex(i => i.id === item.id);
    if (index < 0 || !siblings[index + (direction === 'up' ? -1 : 1)]) return;
    const res = await fetch(`/admin/api/nav/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: direction }),
    });
    if (res.ok) {
      const other = siblings[index + (direction === 'up' ? -1 : 1)];
      setItems(prev => {
        const next = [...(prev ?? [])];
        const a = next.findIndex(i => i.id === item.id);
        const b = next.findIndex(i => i.id === other.id);
        if (a >= 0 && b >= 0) {
          [next[a], next[b]] = [next[b], next[a]];
          next[a] = { ...next[a], sortOrder: item.sortOrder };
          next[b] = { ...next[b], sortOrder: other.sortOrder };
        }
        return next;
      });
    } else alert('Sıralama güncellenemedi.');
  }

  const groupedItems = LOCATIONS.map(loc => ({
    ...loc,
    items: (items ?? []).filter(i => i.location === loc.value),
  }));

  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader title="Menü Yönetimi" description="Site navigasyon öğelerini yönetin"
        action={<AdminActionButton onClick={openCreate} label="Yeni Öğe" icon={Plus} variant="new" />}
      />

      {showForm && (
        <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(23,43,58,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ color: '#172B3A', fontSize: '14px', fontFamily: 'Inter, sans-serif', fontWeight: 600, margin: 0 }}>{editId ? 'Öğeyi Düzenle' : 'Yeni Menü Öğesi'}</h3>
            <button type="button" onClick={() => setShowForm(false)} style={{ minHeight: '44px', minWidth: '44px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: '#718596', cursor: 'pointer', margin: '-10px -10px 0 0' }} aria-label="Kapat"><X size={20} /></button>
          </div>
          {formError && <p style={{ color: '#D64545', fontSize: '12px', fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>{formError}</p>}
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Etiket *</label>
              <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>URL *</label>
              <input type="text" value={href} onChange={(e) => setHref(e.target.value)} style={inputStyle} required placeholder="/sayfa" />
            </div>
            <div>
              <label style={labelStyle}>Konum</label>
              <select value={location} onChange={(e) => setLocation(e.target.value as typeof location)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {LOCATIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Üst Öğe</label>
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">—</option>
                {(items ?? []).filter(i => i.id !== editId).map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Sıra</label>
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value))} style={{ ...inputStyle, width: '80px' }} min={0} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '20px' }}>
              <AdminActionButton type="button" label={active ? 'Aktif' : 'Pasif'} icon={active ? ToggleRight : ToggleLeft} variant={active ? 'activate' : 'subtle'} ariaLabel="Aktifliği değiştir" onClick={() => setActive(v => !v)} className="text-xs" />
              <span style={{ color: '#52697A', fontSize: '14px', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Aktif</span>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
              <AdminActionButton type="submit" label="Kaydet" icon={Check} variant="save" loading={saving} />
              <AdminActionButton type="button" label="İptal" variant="cancel" manage={false} onClick={() => setShowForm(false)} />
            </div>
          </form>
        </div>
      )}

      {loadError ? (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' }}>
          <p style={{ color: '#DC2626', fontSize: '14px', fontFamily: 'Inter, sans-serif', margin: 0, fontWeight: 600 }}>
            {loadError}
          </p>
          <button type="button" onClick={fetchItems} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px', padding: '8px 20px', borderRadius: '8px', background: '#FFFFFF', color: '#DC2626', fontSize: '13px', fontWeight: 600, border: '1px solid #FECACA', cursor: 'pointer' }}>
            Yeniden Dene
          </button>
        </div>
      ) : !items ? (
        <p style={{ color: '#718596', fontFamily: 'Inter, sans-serif', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Loader2 size={16} className="animate-spin" /> Yükleniyor...
        </p>
      ) : (
        groupedItems.map(group => (
          <div key={group.value} style={{ marginBottom: '24px' }}>
            <h3 style={{ color: '#52697A', fontSize: '11px', fontFamily: 'Inter, sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 600 }}>{group.label}</h3>
            {group.items.length === 0 ? (
              <p style={{ color: '#A0B0BC', fontSize: '12px', fontFamily: 'Inter, sans-serif', padding: '12px 0' }}>Bu konumda öğe yok.</p>
            ) : (
              <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', overflow: 'hidden' }}>
                {group.items.map((item, i) => (
                  <div key={item.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', padding: '16px', borderBottom: i < group.items.length - 1 ? '1px solid #EDF2F7' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 200px', minWidth: 0 }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.active ? '#168C5B' : '#D8E1E9', flexShrink: 0 }} />
                      <span style={{ color: '#172B3A', fontSize: '14px', fontFamily: 'Inter, sans-serif', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                      <span style={{ color: '#718596', fontSize: '13px', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.href}</span>
                      <span style={{ color: '#A0B0BC', fontSize: '12px', fontFamily: 'monospace' }}>#{item.sortOrder}</span>
                    </div>
                    <AdminRecordActions
                      up={{ onClick: () => moveItem(item, 'up'), disabled: i === 0, disabledReason: i === 0 ? 'En üstte' : undefined }}
                      down={{ onClick: () => moveItem(item, 'down'), disabled: i === group.items.length - 1, disabledReason: i === group.items.length - 1 ? 'En altta' : undefined }}
                      edit={{ onClick: () => openEdit(item) }}
                      delete={{ onClick: () => handleDelete(item.id), disabled: deleting === item.id }}
                    />
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
