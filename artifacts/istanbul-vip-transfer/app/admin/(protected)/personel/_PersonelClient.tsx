'use client';

import { useState, useEffect, useCallback, useId } from 'react';
import { Plus, RefreshCw, UserCheck, UserX, KeyRound, Save, X } from 'lucide-react';
import AdminPageHeader from '../../_components/AdminPageHeader';
import { AdminRecordActions } from '../../_components/AdminRecordActions';
import { AdminActionButton } from '../../_components/AdminActionButton';

const GOLD = '#C99A32';
const NAVY = '#172B3A';
const MUTED = '#52697A';
const BORDER = '#D8E1E9';
const CARD = '#FFFFFF';
const RED = '#D64545';
const GREEN = '#065F46';

interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  grants: Grant[];
}
interface Grant { section: string; canView: boolean; canManage: boolean }
const SECTIONS = [
  ['dashboard', 'Dashboard'], ['requests', 'Talepler'],
  ['transfer_operations', 'Transfer Operasyonları'], ['analytics', 'İstatistikler'],
  ['reservation_settings', 'Rezervasyon Ayarları'], ['chat', 'Canlı Sohbet'],
  ['chatbot', 'Chatbot Bilgi Bankası'], ['newsletter', 'Bülten Aboneleri'],
  ['fleet_pricing', 'Araçlar ve Transferler'], ['content', 'İçerik'],
  ['translations', 'Dil ve Çeviri'], ['ai_content', 'AI İçerik Merkezi'],
  ['site_navigation', 'Menü Yönetimi'], ['site_settings', 'Site Ayarları'],
  ['security_settings', 'Form Güvenliği'], ['integrations', 'API Anahtarları / Entegrasyonlar'],
  ['audit', 'İşlem Geçmişi'], ['database_backup', 'Veritabanı Yedeği'],
] as const;

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function FieldInput({ label, value, onChange, type = 'text', placeholder = '', required = false }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} style={{ display: 'block', color: MUTED, fontSize: '12px', fontFamily: 'Inter, sans-serif', marginBottom: '5px', fontWeight: 600 }}>
        {label}{required && <span style={{ color: RED, marginLeft: '3px' }}>*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px',
          color: NAVY, fontSize: '14px', fontFamily: 'Inter, sans-serif', padding: '10px 14px', minHeight: '44px',
          outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

export default function PersonelClient() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', grants: [] as Grant[] });
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [formError, setFormError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const fetchStaff = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await fetch('/admin/api/staff');
      const json = await res.json() as { staff?: StaffUser[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Hata');
      setStaff(json.staff ?? []);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Sunucu hatası', 'error');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(true); }, [fetchStaff]);

  async function handleCreate() {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setFormError('Tüm alanlar zorunludur.');
      return;
    }
    if (form.password.length < 8) {
      setFormError('Şifre en az 8 karakter olmalıdır.');
      return;
    }
    setCreating(true);
    setFormError('');
    try {
      const res = await fetch('/admin/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(form),
      });
      const json = await res.json() as { staff?: StaffUser; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Hata');
      showToast('Personel hesabı oluşturuldu.');
       setForm({ name: '', email: '', password: '', grants: [] });
      setShowCreate(false);
      fetchStaff();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Sunucu hatası');
    } finally {
      setCreating(false);
    }
  }

  function toggleGrant(section: string, field: 'canView' | 'canManage', editingUser = false) {
    const setter = editingUser ? (value: Grant[]) => setEditing((user) => user && ({ ...user, grants: value })) : (value: Grant[]) => setForm((current) => ({ ...current, grants: value }));
    const current = editingUser ? (editing?.grants ?? []) : form.grants;
    const previous = current.find((grant) => grant.section === section) ?? { section, canView: false, canManage: false };
    const next = { ...previous, [field]: !previous[field] };
    if (field === 'canView' && !next.canView) next.canManage = false;
    if (field === 'canManage' && next.canManage) next.canView = true;
    setter([...current.filter((grant) => grant.section !== section), next].filter((grant) => grant.canView || grant.canManage));
  }

  async function saveEdit() {
    if (!editing) return;
    setActionLoading(editing.id + '-edit');
    try {
      const res = await fetch(`/admin/api/staff/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editing.name, active: editing.active, grants: editing.grants }) });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Güncellenemedi');
      showToast('Personel güncellendi.'); setEditing(null); fetchStaff();
    } catch (error) { showToast(error instanceof Error ? error.message : 'İşlem başarısız', 'error'); }
    finally { setActionLoading(null); }
  }

  async function resetPassword(user: StaffUser) {
    const password = prompt(`${user.name} için yeni şifre (en az 8 karakter):`);
    if (!password) return;
    const res = await fetch(`/admin/api/staff/${user.id}/password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    if (!res.ok) { const json = await res.json() as { error?: string }; showToast(json.error ?? 'Şifre sıfırlanamadı', 'error'); return; }
    showToast('Şifre güvenli şekilde yenilendi.');
  }

  function GrantEditor({ user, editingUser = false }: { user: { grants: Grant[] }; editingUser?: boolean }) {
    return <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '8px', marginTop: '8px' }}>
      {SECTIONS.map(([key, label]) => {
        const grant = user.grants.find((item) => item.section === key) ?? { section: key, canView: false, canManage: false };
        return <div key={key} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', color: NAVY, fontSize: 12 }}>
          <strong>{label}</strong>
          <label style={{ marginLeft: 10 }}><input type="checkbox" checked={grant.canView} onChange={() => toggleGrant(key, 'canView', editingUser)} /> Görüntüle</label>
          <label style={{ marginLeft: 8 }}><input type="checkbox" checked={grant.canManage} onChange={() => toggleGrant(key, 'canManage', editingUser)} /> Yönet</label>
        </div>;
      })}
    </div>;
  }

  async function handleToggleActive(user: StaffUser) {
    setActionLoading(user.id + '-active');
    try {
      const res = await fetch(`/admin/api/staff/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !user.active }),
      });
      if (!res.ok) throw new Error('Güncellenemedi');
      showToast(`${user.name} ${user.active ? 'devre dışı' : 'aktif'} edildi.`);
      fetchStaff();
    } catch {
      showToast('İşlem başarısız', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(user: StaffUser) {
    if (!confirm(`"${user.name}" hesabı kalıcı olarak silinecek. Onaylıyor musunuz?`)) return;
    setActionLoading(user.id + '-delete');
    try {
      const res = await fetch(`/admin/api/staff/${user.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Silinemedi');
      showToast(`${user.name} silindi.`);
      fetchStaff();
    } catch {
      showToast('İşlem başarısız', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8" style={{ fontFamily: 'Inter, sans-serif' }}>
      <AdminPageHeader
        title="Personel Yönetimi"
         description="Personel hesaplarını, bölüm erişimlerini ve şifre yenilemelerini yönetin."
      />

      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 1000,
          background: toastMsg.type === 'success' ? '#ECFDF5' : '#FEF2F2',
          border: `1px solid ${toastMsg.type === 'success' ? '#86EFAC' : '#FECACA'}`,
          borderRadius: '10px', padding: '12px 18px',
          color: toastMsg.type === 'success' ? GREEN : RED,
          fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        }}>
          {toastMsg.text}
        </div>
      )}

      {/* Header actions */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span style={{ fontSize: '13px', color: MUTED }}>
           {loading ? 'Yükleniyor…' : `${staff.length} personel`}
        </span>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
          <AdminActionButton label="Yenile" icon={RefreshCw} variant="subtle" onClick={() => void fetchStaff()} loading={loading} manage={false} />
          <AdminActionButton label="Yeni Personel Ekle" icon={Plus} variant="new" onClick={() => setShowCreate(s => !s)} />
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '24px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(23,43,58,0.07)' }}>
          <h3 style={{ color: GOLD, fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 16px', paddingBottom: '12px', borderBottom: `1px solid ${BORDER}` }}>
            Yeni Personel
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <FieldInput label="Ad Soyad" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Ali Yılmaz" required />
            <FieldInput label="E-posta" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="ali@example.com" required />
            <div style={{ gridColumn: '1/-1' }}>
              <FieldInput label="Şifre" type="password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} placeholder="En az 8 karakter" required />
            </div>
             <GrantEditor user={form} />
          </div>
          {formError && (
            <div style={{ marginTop: '12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '7px', padding: '9px 13px', color: RED, fontSize: '12px' }}>
              {formError}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <AdminActionButton label="İptal" icon={X} variant="cancel" onClick={() => { setShowCreate(false); setFormError(''); }} manage={false} />
            <AdminActionButton label="Personel Oluştur" icon={Plus} variant="save" type="submit" loading={creating} />
          </div>
          <p style={{ marginTop: '10px', fontSize: '11px', color: MUTED }}>
            Erişimler aşağıdaki bölüm izinleriyle sınırlanır.
          </p>
        </form>
      )}

      {/* Staff table */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', boxShadow: '0 2px 8px rgba(23,43,58,0.06)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: MUTED, fontSize: '13px' }}>Yükleniyor…</div>
        ) : staff.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: MUTED }}>
            <p style={{ fontSize: '14px', marginBottom: '8px' }}>Henüz personel eklenmemiş.</p>
            <p style={{ fontSize: '12px' }}>Yukarıdaki &ldquo;Yeni Personel Ekle&rdquo; butonunu kullanın.</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}`, background: '#F8FAFC' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: MUTED, fontWeight: 600, fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', width: '15%' }}>Ad Soyad</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: MUTED, fontWeight: 600, fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', width: '22%' }}>E-posta</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: MUTED, fontWeight: 600, fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', width: '8%' }}>Durum</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: MUTED, fontWeight: 600, fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', width: '11%' }}>Son Giriş</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: MUTED, fontWeight: 600, fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', width: '11%' }}>Oluşturulma</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', color: MUTED, fontWeight: 600, fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', width: '33%' }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((u, i) => (
                    <tr key={u.id} style={{ borderBottom: i < staff.length - 1 ? `1px solid ${BORDER}` : 'none', background: u.active ? 'transparent' : '#FAFAFA' }}>
                      <td style={{ padding: '12px 14px', color: NAVY, fontWeight: 600, overflowWrap: 'anywhere' }}>{u.name}</td>
                      <td style={{ padding: '12px 14px', color: MUTED, overflowWrap: 'anywhere' }}>{u.email}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                          background: u.active ? '#ECFDF5' : '#F1F5F9',
                          color: u.active ? GREEN : MUTED,
                        }}>
                          {u.active ? <UserCheck size={11} /> : <UserX size={11} />}
                          {u.active ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: MUTED, fontSize: '12px', lineHeight: 1.4 }}>{fmtDate(u.lastLoginAt)}</td>
                      <td style={{ padding: '12px 14px', color: MUTED, fontSize: '12px', lineHeight: 1.4 }}>{fmtDate(u.createdAt)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <AdminRecordActions
                          edit={{
                            onClick: () => setEditing(u),
                          }}
                          activation={{
                            isActive: u.active,
                            onClick: () => handleToggleActive(u),
                            disabled: actionLoading === u.id + '-active',
                          }}
                          delete={{
                            onClick: () => handleDelete(u),
                            disabled: actionLoading === u.id + '-delete',
                          }}
                          customActions={[
                            {
                              id: 'reset-password',
                              label: 'Şifre Yenile',
                              icon: KeyRound,
                              colorClass: 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100',
                              onClick: () => resetPassword(u),
                            }
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-4 p-3 sm:p-4 lg:hidden">
              {staff.map((u) => (
                <div key={u.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 shadow-sm" style={{ background: u.active ? CARD : '#FAFAFA' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-900 m-0 truncate">{u.name}</h3>
                      <p className="mt-1 text-sm font-medium text-slate-600 m-0 break-all">{u.email}</p>
                    </div>
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                        background: u.active ? '#ECFDF5' : '#F1F5F9',
                        color: u.active ? GREEN : MUTED,
                        flexShrink: 0,
                      }}>
                        {u.active ? <UserCheck size={14} /> : <UserX size={14} />}
                        {u.active ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 mt-1">
                    <div>
                      <span className="block font-semibold text-slate-700 mb-0.5 text-[11px] uppercase tracking-wider">Son Giriş</span>
                      {fmtDate(u.lastLoginAt)}
                    </div>
                    <div>
                      <span className="block font-semibold text-slate-700 mb-0.5 text-[11px] uppercase tracking-wider">Oluşturulma</span>
                      {fmtDate(u.createdAt)}
                    </div>
                  </div>

                  <div className="mt-2 flex border-t border-slate-100 pt-3 justify-end">
                    <AdminRecordActions
                      edit={{
                        onClick: () => setEditing(u),
                      }}
                      activation={{
                        isActive: u.active,
                        onClick: () => handleToggleActive(u),
                        disabled: actionLoading === u.id + '-active',
                      }}
                      delete={{
                        onClick: () => handleDelete(u),
                        disabled: actionLoading === u.id + '-delete',
                      }}
                      customActions={[
                        {
                          id: 'reset-password',
                          label: 'Şifre Yenile',
                          icon: KeyRound,
                          colorClass: 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100',
                          onClick: () => resetPassword(u),
                        }
                      ]}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {editing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15,23,42,.45)', display: 'grid', placeItems: 'center', padding: 20 }}>
          <div style={{ width: 'min(720px,100%)', maxHeight: '90vh', overflowY: 'auto', background: CARD, borderRadius: 12, padding: 24 }}>
            <h2 style={{ margin: '0 0 18px', color: NAVY, fontSize: 18 }}>Personeli Düzenle</h2>
            <div style={{ display: 'grid', gap: 14 }}>
              <FieldInput label="Ad Soyad" value={editing.name} onChange={name => setEditing({ ...editing, name })} required />
              <div style={{ color: MUTED, fontSize: 13 }}>{editing.email}</div>
              <label style={{ color: NAVY, fontSize: 13 }}><input type="checkbox" checked={editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked })} /> Aktif</label>
              <GrantEditor user={editing} editingUser />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <AdminActionButton label="İptal" icon={X} variant="cancel" onClick={() => setEditing(null)} manage={false} />
              <AdminActionButton label="Kaydet" icon={Save} variant="save" onClick={saveEdit} loading={actionLoading === editing.id + '-edit'} />
            </div>
          </div>
        </div>
      )}

      <p style={{ marginTop: '14px', fontSize: '11px', color: MUTED }}>
        Şifreler hiçbir zaman görüntülenmez; şifre yenileme ayrı ve güvenli bir işlem olarak yapılır.
      </p>
    </div>
  );
}
