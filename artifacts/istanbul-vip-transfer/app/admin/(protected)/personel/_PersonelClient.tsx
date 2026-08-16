'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, RefreshCw, UserCheck, UserX } from 'lucide-react';
import AdminPageHeader from '../../_components/AdminPageHeader';

const GOLD = '#C99A32';
const NAVY = '#172B3A';
const MUTED = '#52697A';
const BORDER = '#D8E1E9';
const CARD = '#FFFFFF';
const RED = '#D64545';
const GREEN = '#065F46';
const BLUE = '#2563EB';

interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Btn({ children, onClick, variant = 'primary', loading = false, disabled = false }: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}) {
  const bg = variant === 'primary' ? BLUE : variant === 'danger' ? RED : 'transparent';
  const color = variant === 'ghost' ? NAVY : '#fff';
  const border = variant === 'ghost' ? `1px solid ${BORDER}` : 'none';
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        background: bg, color, border, padding: '8px 14px', borderRadius: '7px',
        fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 600,
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        opacity: loading || disabled ? 0.6 : 1,
        display: 'inline-flex', alignItems: 'center', gap: '6px',
      }}
    >
      {children}
    </button>
  );
}

function FieldInput({ label, value, onChange, type = 'text', placeholder = '', required = false }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label style={{ display: 'block', color: MUTED, fontSize: '12px', fontFamily: 'Inter, sans-serif', marginBottom: '5px', fontWeight: 600 }}>
        {label}{required && <span style={{ color: RED, marginLeft: '3px' }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '7px',
          color: NAVY, fontSize: '13px', fontFamily: 'Inter, sans-serif', padding: '9px 12px',
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
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [formError, setFormError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/admin/api/staff');
      const json = await res.json() as { staff?: StaffUser[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Hata');
      setStaff(json.staff ?? []);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Sunucu hatası', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

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
      setForm({ name: '', email: '', password: '' });
      setShowCreate(false);
      fetchStaff();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Sunucu hatası');
    } finally {
      setCreating(false);
    }
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
    <div style={{ padding: '28px 24px', maxWidth: '900px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <AdminPageHeader
        title="Personel Yönetimi"
        description="Canlı sohbet panelini kullanacak sohbet personellerini yönetin."
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <span style={{ fontSize: '13px', color: MUTED }}>
          {loading ? 'Yükleniyor…' : `${staff.length} sohbet personeli`}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Btn variant="ghost" onClick={fetchStaff} loading={loading}>
            <RefreshCw size={14} /> Yenile
          </Btn>
          <Btn onClick={() => setShowCreate(s => !s)}>
            <Plus size={14} /> Yeni Personel Ekle
          </Btn>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '24px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(23,43,58,0.07)' }}>
          <h3 style={{ color: GOLD, fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 16px', paddingBottom: '12px', borderBottom: `1px solid ${BORDER}` }}>
            Yeni Sohbet Personeli
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <FieldInput label="Ad Soyad" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Ali Yılmaz" required />
            <FieldInput label="E-posta" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="ali@example.com" required />
            <div style={{ gridColumn: '1/-1' }}>
              <FieldInput label="Şifre" type="password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} placeholder="En az 8 karakter" required />
            </div>
          </div>
          {formError && (
            <div style={{ marginTop: '12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '7px', padding: '9px 13px', color: RED, fontSize: '12px' }}>
              {formError}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <Btn variant="ghost" onClick={() => { setShowCreate(false); setFormError(''); }}>İptal</Btn>
            <Btn loading={creating} onClick={handleCreate}>Oluştur</Btn>
          </div>
          <p style={{ marginTop: '10px', fontSize: '11px', color: MUTED }}>
            Bu hesap yalnızca <strong>/admin/sohbet</strong> sayfasına erişebilir. Diğer admin sayfalarına erişimi yoktur.
          </p>
        </div>
      )}

      {/* Staff table */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', boxShadow: '0 2px 8px rgba(23,43,58,0.06)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: MUTED, fontSize: '13px' }}>Yükleniyor…</div>
        ) : staff.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: MUTED }}>
            <p style={{ fontSize: '14px', marginBottom: '8px' }}>Henüz sohbet personeli eklenmemiş.</p>
            <p style={{ fontSize: '12px' }}>Yukarıdaki "Yeni Personel Ekle" butonunu kullanın.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}`, background: '#F8FAFC' }}>
                  {['Ad Soyad', 'E-posta', 'Durum', 'Son Giriş', 'Oluşturulma', 'İşlem'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: MUTED, fontWeight: 600, fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: i < staff.length - 1 ? `1px solid ${BORDER}` : 'none', background: u.active ? 'transparent' : '#FAFAFA' }}>
                    <td style={{ padding: '12px 16px', color: NAVY, fontWeight: 600 }}>{u.name}</td>
                    <td style={{ padding: '12px 16px', color: MUTED }}>{u.email}</td>
                    <td style={{ padding: '12px 16px' }}>
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
                    <td style={{ padding: '12px 16px', color: MUTED, fontSize: '12px' }}>{fmtDate(u.lastLoginAt)}</td>
                    <td style={{ padding: '12px 16px', color: MUTED, fontSize: '12px' }}>{fmtDate(u.createdAt)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => handleToggleActive(u)}
                          disabled={actionLoading === u.id + '-active'}
                          title={u.active ? 'Devre dışı bırak' : 'Aktif et'}
                          style={{
                            background: u.active ? '#FEF9EE' : '#ECFDF5',
                            border: `1px solid ${u.active ? '#FCD34D' : '#86EFAC'}`,
                            color: u.active ? '#92400E' : GREEN,
                            borderRadius: '6px', padding: '5px 10px', cursor: 'pointer',
                            fontSize: '11px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
                          }}
                        >
                          {actionLoading === u.id + '-active' ? '…' : u.active ? 'Devre Dışı' : 'Aktif Et'}
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          disabled={actionLoading === u.id + '-delete'}
                          title="Kalıcı sil"
                          style={{
                            background: '#FEF2F2', border: '1px solid #FECACA',
                            color: RED, borderRadius: '6px', padding: '5px 8px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center',
                          }}
                        >
                          {actionLoading === u.id + '-delete' ? '…' : <Trash2 size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p style={{ marginTop: '14px', fontSize: '11px', color: MUTED }}>
        Sohbet personeli yalnızca Canlı Sohbet paneline erişebilir. Giriş şifresi değiştirme için hesabı silin ve yeniden oluşturun.
      </p>
    </div>
  );
}
