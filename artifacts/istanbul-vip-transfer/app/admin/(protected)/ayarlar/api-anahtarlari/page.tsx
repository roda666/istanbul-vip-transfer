'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, KeyRound, Loader2, Save } from 'lucide-react';
import AdminPageHeader from '../../../_components/AdminPageHeader';

type Entry = {
  key: string; label: string; purpose: string; editable: boolean;
  configured: boolean; source: 'database' | 'environment' | 'existing_connection' | 'none';
  masked: string | null;
};

export default function ApiAnahtarlariPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function load() {
    const result = await fetch('/admin/api/integration-secrets');
    const data = await result.json().catch(() => ({}));
    if (result.ok) setEntries(data.entries ?? []);
    else setMessage(data.error ?? 'Entegrasyonlar yüklenemedi.');
  }
  useEffect(() => { void load(); }, []);
  async function save(key: string) {
    const value = values[key]?.trim();
    if (!value) return;
    setSaving(key); setMessage('');
    try {
      const res = await fetch('/admin/api/integration-secrets', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMessage(data.error ?? 'Kaydedilemedi.');
      else { setValues(v => ({ ...v, [key]: '' })); setMessage('Anahtar güvenli olarak kaydedildi.'); await load(); }
    } catch { setMessage('Sunucu hatası.'); } finally { setSaving(null); }
  }
  return <div style={{ padding: '28px 24px', maxWidth: 920 }}>
    <AdminPageHeader title="API Anahtarları / Entegrasyonlar" description="Yalnızca SUPER_ADMIN üçüncü taraf kimlik bilgilerini yönetebilir." />
    {message && <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#168C5B', fontSize: 13 }}><CheckCircle size={14} style={{ verticalAlign: 'middle', marginRight: 7 }} />{message}</div>}
    <p style={{ fontSize: 12, color: '#52697A', marginBottom: 16 }}>Değerler hiçbir zaman tekrar gösterilmez. WhatsApp için API anahtarı yoktur; numara Site Ayarları&apos;nda yönetilir. GSC erişim belirteçleri kendi bağlantı deposunda kalır.</p>
    <div style={{ display: 'grid', gap: 12 }}>
      {entries.map(entry => <section key={entry.key} style={{ background: '#fff', border: '1px solid #D8E1E9', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <KeyRound size={18} color="#C99A32" style={{ marginTop: 2 }} />
          <div style={{ flex: '1 1 360px' }}>
            <strong style={{ color: '#172B3A', fontSize: 14 }}>{entry.label}</strong>
            <p style={{ margin: '4px 0', color: '#718596', fontSize: 12 }}>{entry.purpose}</p>
            <span style={{ fontSize: 12, color: entry.configured ? '#168C5B' : '#B45309' }}>{entry.configured ? 'Yapılandırıldı' : 'Yapılandırılmadı'} · {entry.source === 'database' ? 'Veritabanı' : entry.source === 'environment' ? 'Ortam değişkeni' : entry.source === 'existing_connection' ? 'Mevcut bağlantı' : 'Yok'}{entry.masked ? ` · ${entry.masked}` : ''}</span>
          </div>
          {entry.editable && <div style={{ display: 'flex', gap: 8, flex: '1 1 280px' }}>
            <input aria-label={`${entry.label} yeni değer`} type="password" value={values[entry.key] ?? ''} onChange={e => setValues(v => ({ ...v, [entry.key]: e.target.value }))} style={{ flex: 1, minWidth: 0, padding: '9px 10px', border: '1px solid #D8E1E9', borderRadius: 8 }} placeholder="Yeni değer" />
            <button onClick={() => void save(entry.key)} disabled={saving === entry.key || !values[entry.key]?.trim()} style={{ minHeight: 38, padding: '0 12px', border: 0, borderRadius: 8, background: '#2563EB', color: '#fff', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>{saving === entry.key ? <Loader2 size={15} /> : <Save size={15} />} Kaydet</button>
          </div>}
        </div>
      </section>)}
    </div>
  </div>;
}