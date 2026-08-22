'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, Link2, Loader2, Power, RefreshCw, Send } from 'lucide-react';
import { getSocialOAuthMessage, getSocialPlatformLastErrorMessage } from '@/lib/social-oauth-feedback';

type Platform = {
  key: string;
  name: string;
  description: string;
  authType: string;
  requiredSecrets: string[];
  canConnect: boolean;
  connected: boolean;
  enabled: boolean;
  connectionMeta: Record<string, unknown>;
  lastPublishUrl: string | null;
  lastError: string | null;
};

const connectHref = (platform: Platform) =>
  platform.authType === 'meta_oauth'
    ? '/admin/api/social-platforms/meta/connect'
    : platform.authType === 'x_oauth1'
      ? '/admin/api/social-platforms/x/connect'
      : null;

export default function SocialPlatformsPanel() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const popupPollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/admin/api/social-platforms', { cache: 'no-store' });
      const payload = await response.json() as { platforms?: Platform[]; error?: string };
      if (!response.ok || !payload.platforms) throw new Error(payload.error ?? 'Platformlar yüklenemedi.');
      setPlatforms(payload.platforms);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Platformlar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      if (popupPollRef.current !== null) window.clearInterval(popupPollRef.current);
    };
  }, [load]);

  useEffect(() => {
    function handleOAuthMessage(event: MessageEvent<{
      provider?: string;
      success?: boolean;
      message?: string;
      error?: string;
    }>) {
      if (event.origin !== window.location.origin || event.data?.provider === undefined) return;
      if (!['meta', 'x'].includes(event.data.provider)) return;

      if (popupPollRef.current !== null) {
        window.clearInterval(popupPollRef.current);
        popupPollRef.current = null;
      }
      setBusyKey(null);
      if (event.data.success) {
        setError(null);
        setMessage(event.data.message ?? 'Bağlantı tamamlandı.');
      } else {
        setMessage(null);
        setError(getSocialOAuthMessage(event.data.error));
      }
      void load();
    }

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [load]);

  function connect(platform: Platform, href: string) {
    setBusyKey(platform.key);
    setError(null);
    setMessage(null);

    if (popupPollRef.current !== null) {
      window.clearInterval(popupPollRef.current);
      popupPollRef.current = null;
    }

    const width = 620;
    const height = 760;
    const left = Math.max(0, Math.round((window.screen.width - width) / 2));
    const top = Math.max(0, Math.round((window.screen.height - height) / 2));
    const popup = window.open(
      href,
      `social-oauth-${platform.key}`,
      `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
    );

    if (!popup) {
      setBusyKey(null);
      setError('OAuth penceresi tarayıcı tarafından engellendi. Akış aynı sekmede açılıyor.');
      window.location.assign(href);
      return;
    }

    popup.focus();
    popupPollRef.current = window.setInterval(() => {
      if (popup.closed) {
        if (popupPollRef.current !== null) {
          window.clearInterval(popupPollRef.current);
          popupPollRef.current = null;
        }
        setBusyKey(null);
        setError((current) => current ?? 'Bağlantı penceresi kapandı. Yetkilendirme tamamlanmadıysa tekrar deneyin.');
        void load();
      }
    }, 500);
  }

  async function toggle(platform: Platform) {
    setBusyKey(platform.key);
    setError(null);
    try {
      const response = await fetch(`/admin/api/social-platforms/${platform.key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !platform.enabled }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Durum güncellenemedi.');
      setPlatforms((items) => items.map((item) => item.key === platform.key ? { ...item, enabled: !platform.enabled } : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Durum güncellenemedi.');
    } finally {
      setBusyKey(null);
    }
  }

  async function testLatestBlog(platform: Platform) {
    const testKey = `${platform.key}-test`;
    setBusyKey(testKey);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/admin/api/social-platforms/${platform.key}/test`, { method: 'POST' });
      const payload = await response.json() as { result?: { url?: string | null }; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error ?? 'Test paylaşımı gönderilemedi.');
      setMessage(payload.result.url ? `Test paylaşımı gönderildi: ${payload.result.url}` : 'Test paylaşımı gönderildi.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Test paylaşımı gönderilemedi.');
    } finally {
      setBusyKey(null);
    }
  }

  const connected = platforms.filter((platform) => platform.connected);
  const active = connected.filter((platform) => platform.enabled);

  return (
    <section style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', marginBottom: 0 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #E8EDF2', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link2 size={18} color="#2563EB" />
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 700, color: '#172B3A', margin: 0 }}>Sosyal Medya Kanalları</h2>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#52697A', margin: '4px 0 0' }}>
            {loading ? 'Bağlantı durumları kontrol ediliyor…' : `${connected.length}/${platforms.length} platform bağlı, ${active.length}/${connected.length} bağlı platform aktif`}
          </p>
        </div>
        <button onClick={() => void load()} disabled={loading} title="Durumları yenile" style={{ border: 'none', background: 'transparent', color: '#52697A', cursor: loading ? 'wait' : 'pointer', padding: 5 }}>
          <RefreshCw size={16} />
        </button>
      </div>

      {(error || message) && (
        <div style={{ margin: '14px 20px 0', padding: '10px 12px', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'flex-start', background: error ? '#FEF2F2' : '#F0FDF4', color: error ? '#991B1B' : '#14532D', fontFamily: 'Inter, sans-serif', fontSize: 12 }}>
          {error ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
          <span>{error ?? message}</span>
        </div>
      )}

      <div style={{ padding: '16px 20px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(245px, 1fr))', gap: 12 }}>
        {loading ? (
          <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Inter, sans-serif', color: '#52697A', fontSize: 13 }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Yükleniyor…
          </div>
        ) : platforms.map((platform) => {
          const href = connectHref(platform);
          const isBusy = busyKey === platform.key;
          return (
            <div key={platform.key} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 14, background: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ color: '#172B3A', fontFamily: 'Inter, sans-serif', fontSize: 13 }}>{platform.name}</strong>
                <span style={{ fontSize: 10, fontWeight: 700, color: platform.connected ? '#168C5B' : '#D97706', background: platform.connected ? '#F0FDF4' : '#FFF7ED', padding: '3px 7px', borderRadius: 10 }}>
                  {platform.connected ? 'Bağlı' : 'Bağlı Değil'}
                </span>
              </div>
              <p style={{ fontFamily: 'Inter, sans-serif', color: '#52697A', fontSize: 12, lineHeight: 1.45, minHeight: 34, margin: '8px 0' }}>{platform.description}</p>
              {platform.requiredSecrets.length > 0 && !platform.connected && (
                <p style={{ fontFamily: 'monospace', color: '#64748B', fontSize: 9, margin: '0 0 9px', lineHeight: 1.45 }}>{platform.requiredSecrets.join(' · ')}</p>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {href && !platform.connected ? (
                  <button
                    type="button"
                    onClick={() => connect(platform, href)}
                    disabled={busyKey === platform.key}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 0, background: '#2563EB', color: '#fff', padding: '7px 10px', borderRadius: 7, fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, cursor: busyKey === platform.key ? 'wait' : 'pointer' }}
                  >
                    {busyKey === platform.key ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <ExternalLink size={12} />}
                    {busyKey === platform.key ? 'Bağlanıyor…' : 'Bağlan'}
                  </button>
                ) : !platform.canConnect ? (
                  <span style={{ color: '#94A3B8', fontFamily: 'Inter, sans-serif', fontSize: 11 }}>Yakında</span>
                ) : (
                  <span style={{ color: '#168C5B', fontFamily: 'Inter, sans-serif', fontSize: 11 }}>Bağlantı hazır</span>
                )}
                <button
                  type="button"
                  onClick={() => void toggle(platform)}
                  disabled={!platform.connected || isBusy}
                  title={!platform.connected ? 'Önce bağlanmalı' : platform.enabled ? 'Pasife al' : 'Aktife al'}
                  style={{
                    marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 7, padding: '7px 9px',
                    border: `1px solid ${platform.enabled ? '#86EFAC' : '#D8E1E9'}`,
                    background: platform.enabled ? '#F0FDF4' : '#F8FAFC',
                    color: platform.enabled ? '#168C5B' : '#64748B',
                    cursor: !platform.connected || isBusy ? 'not-allowed' : 'pointer',
                    opacity: !platform.connected ? 0.55 : 1,
                    fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700,
                  }}
                >
                  <Power size={12} /> {platform.enabled ? 'Aktif' : 'Pasif'}
                </button>
              </div>
              {(['facebook', 'instagram', 'x'].includes(platform.key) && platform.connected && platform.enabled) && (
                <button onClick={() => void testLatestBlog(platform)} disabled={busyKey === `${platform.key}-test`} style={{ marginTop: 10, width: '100%', border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', borderRadius: 7, padding: '7px 9px', fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, cursor: busyKey === `${platform.key}-test` ? 'wait' : 'pointer' }}>
                  <Send size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} /> {busyKey === `${platform.key}-test` ? 'Gönderiliyor…' : 'Yayınlanmış blogla test paylaşımı yap'}
                </button>
              )}
              {platform.lastPublishUrl && (
                <a href={platform.lastPublishUrl} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 9, fontFamily: 'Inter, sans-serif', color: '#2563EB', fontSize: 11, fontWeight: 600 }}>
                  Son paylaşımı aç <ExternalLink size={11} style={{ verticalAlign: 'middle' }} />
                </a>
              )}
              {platform.lastError && (
                <p style={{ fontFamily: 'Inter, sans-serif', color: '#B45309', fontSize: 10, margin: '9px 0 0' }}>
                  {getSocialPlatformLastErrorMessage(platform.key, platform.lastError)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}