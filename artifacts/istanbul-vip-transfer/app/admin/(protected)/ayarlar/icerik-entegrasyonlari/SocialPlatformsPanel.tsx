'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, Link2, Loader2, Power, RefreshCw, Send } from 'lucide-react';
import { getSocialOAuthMessage, getSocialPlatformLastErrorMessage, isGoogleReconnectRequired } from '@/lib/social-oauth-feedback';
import FacebookShareButton from '@/app/admin/_components/FacebookShareButton';
import XShareButton from '@/app/admin/_components/XShareButton';
import LinkedInShareButton from '@/app/admin/_components/LinkedInShareButton';
import TelegramShareButton from '@/app/admin/_components/TelegramShareButton';
import { AdminActionButton } from '@/app/admin/_components/AdminActionButton';

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

type LatestPublishedBlog = {
  title: string;
  summary: string | null;
  url: string;
};

type GoogleBusinessLocation = {
  accountName: string;
  accountLabel: string;
  locationName: string;
  locationLabel: string;
};

const connectHref = (platform: Platform) =>
  platform.authType === 'meta_oauth'
    ? '/admin/api/social-platforms/meta/connect'
    : platform.authType === 'x_oauth1'
      ? '/admin/api/social-platforms/x/connect'
      : platform.authType === 'google_oauth'
        ? '/admin/api/social-platforms/google-business/connect'
      : null;

export default function SocialPlatformsPanel() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latestBlog, setLatestBlog] = useState<LatestPublishedBlog | null>(null);
  const [profileLinks, setProfileLinks] = useState({ tiktokUrl: '', youtubeUrl: '' });
  const [approvalGateEnabled, setApprovalGateEnabled] = useState(true);
  const [googleLocations, setGoogleLocations] = useState<GoogleBusinessLocation[]>([]);
  const [googleOptionsError, setGoogleOptionsError] = useState<string | null>(null);
  const [googleOptionsLoading, setGoogleOptionsLoading] = useState(false);
  const [googleFeedback, setGoogleFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const popupPollRef = useRef<number | null>(null);
  const loadInProgressRef = useRef(false);
  const initialLoadCompleteRef = useRef(false);

  const load = useCallback(async () => {
    if (loadInProgressRef.current) return;
    loadInProgressRef.current = true;
    if (!initialLoadCompleteRef.current) setLoading(true);
    setError(null);
    try {
      const [response, latestBlogResponse, settingsResponse] = await Promise.all([
        fetch('/admin/api/social-platforms', { cache: 'no-store' }),
        fetch('/admin/api/social-platforms/latest-blog', { cache: 'no-store' }),
        fetch('/admin/api/settings', { cache: 'no-store' }),
      ]);
      const payload = await response.json() as { platforms?: Platform[]; error?: string };
      if (!response.ok || !payload.platforms) throw new Error(payload.error ?? 'Platformlar yüklenemedi.');
      setPlatforms(payload.platforms);
      const googleBusiness = payload.platforms.find((platform) => platform.key === 'google_business');
      if (googleBusiness?.connected) {
        setGoogleOptionsLoading(true);
        setGoogleOptionsError(null);
        const optionsResponse = await fetch('/admin/api/social-platforms/google-business/options', { cache: 'no-store' });
        const optionsPayload = await optionsResponse.json() as { locations?: GoogleBusinessLocation[]; error?: string };
        if (optionsResponse.ok) {
          setGoogleLocations(optionsPayload.locations ?? []);
        } else {
          setGoogleLocations([]);
          setGoogleOptionsError(optionsPayload.error ?? 'Google hesap ve işletme konumları alınamadı.');
        }
        setGoogleOptionsLoading(false);
      } else {
        setGoogleLocations([]);
        setGoogleOptionsError(null);
        setGoogleOptionsLoading(false);
      }

      if (latestBlogResponse.ok) {
        const latestBlogPayload = await latestBlogResponse.json() as { post?: LatestPublishedBlog };
        setLatestBlog(latestBlogPayload.post ?? null);
      } else {
        setLatestBlog(null);
      }
      if (settingsResponse.ok) {
        const settingsPayload = await settingsResponse.json() as {
          settings?: { tiktokUrl?: string | null; youtubeUrl?: string | null; approvalGateEnabled?: boolean };
        };
        setProfileLinks({
          tiktokUrl: settingsPayload.settings?.tiktokUrl ?? '',
          youtubeUrl: settingsPayload.settings?.youtubeUrl ?? '',
        });
        setApprovalGateEnabled(settingsPayload.settings?.approvalGateEnabled ?? true);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Platformlar yüklenemedi.');
    } finally {
      setLoading(false);
      setGoogleOptionsLoading(false);
      loadInProgressRef.current = false;
      initialLoadCompleteRef.current = true;
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
      if (!['meta', 'x', 'google_business'].includes(event.data.provider)) return;

      if (popupPollRef.current !== null) {
        window.clearInterval(popupPollRef.current);
        popupPollRef.current = null;
      }
      setBusyKey(null);
      if (event.data.success) {
        setError(null);
        if (event.data.provider === 'google_business') {
          setGoogleFeedback({ type: 'success', text: event.data.message ?? 'Google Business Profile bağlantısı tamamlandı.' });
        } else {
          setMessage(event.data.message ?? 'Bağlantı tamamlandı.');
        }
      } else {
        const text = getSocialOAuthMessage(event.data.error);
        if (event.data.provider === 'google_business') {
          setGoogleFeedback({ type: 'error', text });
        } else {
          setMessage(null);
          setError(text);
        }
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
    if (platform.key === 'google_business') setGoogleFeedback(null);

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
      const text = 'OAuth penceresi tarayıcı tarafından engellendi. Akış aynı sekmede açılıyor.';
      if (platform.key === 'google_business') setGoogleFeedback({ type: 'error', text });
      else setError(text);
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
        const text = 'Bağlantı penceresi kapandı. Yetkilendirme tamamlanmadıysa tekrar deneyin.';
        if (platform.key === 'google_business') {
          setGoogleFeedback((current) => current ?? { type: 'error', text });
        } else {
          setError((current) => current ?? text);
        }
        void load();
      }
    }, 500);
  }

  async function toggle(platform: Platform) {
    setBusyKey(platform.key);
    setError(null);
    if (platform.key === 'google_business') setGoogleFeedback(null);
    try {
      const response = await fetch(`/admin/api/social-platforms/${platform.key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !platform.enabled }),
      });
      const payload = await response.json() as { error?: string; platform?: { enabled?: boolean } };
      if (!response.ok) throw new Error(payload.error ?? 'Durum güncellenemedi.');
      const enabled = payload.platform?.enabled ?? !platform.enabled;
      setPlatforms((items) => items.map((item) => item.key === platform.key ? { ...item, enabled } : item));
      if (platform.key === 'google_business') {
        setGoogleFeedback({
          type: 'success',
          text: enabled ? 'Google Business Profile kanalı aktifleştirildi.' : 'Google Business Profile kanalı pasife alındı.',
        });
      }
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : 'Durum güncellenemedi.';
      if (platform.key === 'google_business') setGoogleFeedback({ type: 'error', text });
      else setError(text);
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
      setMessage(payload.result.url
        ? `Meta tarafından kabul edildi: ${payload.result.url}`
        : 'Platform tarafından kabul edildi; yayın bağlantısı henüz sağlanmadı.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Test paylaşımı gönderilemedi.');
    } finally {
      setBusyKey(null);
    }
  }

  async function saveProfileLink(key: 'tiktokUrl' | 'youtubeUrl') {
    setBusyKey(key);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/admin/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: profileLinks[key].trim() || null }),
      });
      const payload = await response.json() as { error?: string; settings?: { tiktokUrl?: string | null; youtubeUrl?: string | null } };
      if (!response.ok) throw new Error(payload.error ?? 'Bağlantı kaydedilemedi.');
      setProfileLinks({
        tiktokUrl: payload.settings?.tiktokUrl ?? '',
        youtubeUrl: payload.settings?.youtubeUrl ?? '',
      });
      setMessage(key === 'tiktokUrl' ? 'TikTok bağlantısı kaydedildi.' : 'YouTube bağlantısı kaydedildi.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Bağlantı kaydedilemedi.');
    } finally {
      setBusyKey(null);
    }
  }

  async function saveApprovalGate(enabled: boolean) {
    setBusyKey('approval-gate');
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/admin/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalGateEnabled: enabled }),
      });
      const payload = await response.json() as { error?: string; settings?: { approvalGateEnabled?: boolean } };
      if (!response.ok) throw new Error(payload.error ?? 'Onay ayarı güncellenemedi.');
      setApprovalGateEnabled(payload.settings?.approvalGateEnabled ?? enabled);
      setMessage(enabled
        ? 'Onay kapısı etkin: onaylanmamış içerik yayımlanamaz.'
        : 'Onay kapısı hesap sahibi tarafından kapatıldı.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Onay ayarı güncellenemedi.');
    } finally {
      setBusyKey(null);
    }
  }

  async function selectGoogleLocation(value: string) {
    let selected: GoogleBusinessLocation;
    try {
      selected = JSON.parse(value) as GoogleBusinessLocation;
    } catch {
      setError('Geçersiz Google Business Profile konumu.');
      return;
    }
    setBusyKey('google-business-location');
    setError(null);
    setGoogleFeedback(null);
    try {
      const response = await fetch('/admin/api/social-platforms/google-business/options', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountName: selected.accountName, locationName: selected.locationName }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Google işletme konumu seçilemedi.');
      setGoogleFeedback({ type: 'success', text: 'Google Business Profile konumu seçildi. Kanalı aktifleştirip yorumları senkronlayabilirsiniz.' });
      await load();
    } catch (caught) {
      setGoogleFeedback({
        type: 'error',
        text: caught instanceof Error ? caught.message : 'Google işletme konumu seçilemedi.',
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function syncGoogleReviews() {
    setBusyKey('google-business-sync');
    setError(null);
    setMessage(null);
    setGoogleFeedback(null);
    try {
      const response = await fetch('/admin/api/social-platforms/google-business/sync-reviews', { method: 'POST' });
      const payload = await response.json() as { result?: { upserted: number; received: number }; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error ?? 'Google yorumları senkronlanamadı.');
      setGoogleFeedback({ type: 'success', text: `${payload.result.upserted}/${payload.result.received} gerçek Google yorumu senkronlandı.` });
      await load();
    } catch (caught) {
      setGoogleFeedback({
        type: 'error',
        text: caught instanceof Error ? caught.message : 'Google yorumları senkronlanamadı.',
      });
      void load();
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
      <div style={{ margin: '14px 20px 0', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, fontFamily: 'Inter, sans-serif' }}>
          <strong style={{ color: '#172B3A', fontSize: 12 }}>İçerik onay kapısı</strong>
          <p style={{ color: '#52697A', fontSize: 10, margin: '3px 0 0' }}>
            {approvalGateEnabled ? 'Etkin — onaylanmamış içerik hiçbir yayın yolundan yayımlanamaz.' : 'Kapalı — yalnızca hesap sahibi tarafından açıkça kapatıldı.'}
          </p>
        </div>
        <AdminActionButton type="button" onClick={() => void saveApprovalGate(!approvalGateEnabled)} disabled={busyKey === 'approval-gate'} loading={busyKey === 'approval-gate'} label={busyKey === 'approval-gate' ? 'Kaydediliyor…' : approvalGateEnabled ? 'Pasifleştir' : 'Aktifleştir'} variant={approvalGateEnabled ? 'deactivate' : 'activate'} />
      </div>

      <div style={{ padding: '16px 20px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(245px, 1fr))', gap: 12 }}>
        {loading ? (
          <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Inter, sans-serif', color: '#52697A', fontSize: 13 }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Yükleniyor…
          </div>
        ) : platforms.map((platform) => {
          const href = connectHref(platform);
          const isBusy = busyKey === platform.key;
          const connectionMeta = platform.connectionMeta ?? {};
          const googleSelectionMissing = platform.key === 'google_business' &&
            platform.connected &&
            (typeof connectionMeta.accountName !== 'string' ||
              typeof connectionMeta.locationName !== 'string');
          const googleActivationBlocked = googleSelectionMissing && !platform.enabled;
          const toggleDisabled = !platform.connected || isBusy || googleActivationBlocked;
          const reconnectRequired = platform.key === 'google_business' &&
            isGoogleReconnectRequired(platform.lastError);
          const showConnectAction = Boolean(href) && (
            !platform.connected ||
            reconnectRequired ||
            (platform.key === 'google_business' && !platform.enabled)
          );
          return (
            <div key={platform.key} data-testid={`social-platform-card-${platform.key}`} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 14, background: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ color: '#172B3A', fontFamily: 'Inter, sans-serif', fontSize: 13 }}>{platform.name}</strong>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: reconnectRequired ? '#B45309' : platform.connected ? '#168C5B' : '#D97706', background: reconnectRequired ? '#FFF7ED' : platform.connected ? '#F0FDF4' : '#FFF7ED', padding: '3px 7px', borderRadius: 10 }}>
                    {reconnectRequired ? 'Yeniden bağlantı gerekli' : platform.connected ? 'Bağlı' : 'Bağlı Değil'}
                  </span>
                  {platform.connected && (
                    <span aria-label="Kanal durumu" data-testid={`social-platform-status-${platform.key}`} style={{ fontSize: 10, fontWeight: 700, color: platform.enabled ? '#168C5B' : '#64748B', background: platform.enabled ? '#F0FDF4' : '#F1F5F9', padding: '3px 7px', borderRadius: 10 }}>
                      {platform.enabled ? 'Aktif' : 'Pasif'}
                    </span>
                  )}
                </div>
              </div>
              <p style={{ fontFamily: 'Inter, sans-serif', color: '#52697A', fontSize: 12, lineHeight: 1.45, minHeight: 34, margin: '8px 0' }}>{platform.description}</p>
              {platform.requiredSecrets.length > 0 && !platform.connected && (
                <p style={{ fontFamily: 'monospace', color: '#64748B', fontSize: 9, margin: '0 0 9px', lineHeight: 1.45 }}>{platform.requiredSecrets.join(' · ')}</p>
              )}
              {platform.key === 'google_business' && (!platform.connected || reconnectRequired) && (
                <p style={{ fontFamily: 'Inter, sans-serif', color: '#64748B', fontSize: 10, margin: '0 0 9px', lineHeight: 1.45 }}>
                  Google Cloud’da Business Profile API erişimini açın, işletme yöneticisi hesabıyla yetkilendirin ve OAuth redirect URI olarak
                  {' '}<code>https://www.istanbulviptransfer.com/admin/api/social-platforms/google-business/callback</code>{' '}
                  adresini tanımlayın.
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {showConnectAction && href ? (
                  <AdminActionButton type="button" testId={`social-platform-connect-${platform.key}`} onClick={() => connect(platform, href)} disabled={busyKey === platform.key} loading={busyKey === platform.key} label={busyKey === platform.key ? 'Bağlanıyor…' : platform.connected ? 'Yeniden Bağla' : 'Bağlan'} icon={ExternalLink} variant="new" />
                ) : !platform.canConnect ? (
                  <span style={{ color: '#94A3B8', fontFamily: 'Inter, sans-serif', fontSize: 11 }}>Yakında</span>
                ) : (
                  <span style={{ color: '#168C5B', fontFamily: 'Inter, sans-serif', fontSize: 11 }}>Bağlantı hazır</span>
                )}
                <AdminActionButton type="button" testId={`social-platform-toggle-${platform.key}`} onClick={() => void toggle(platform)} disabled={toggleDisabled} loading={isBusy} title={!platform.connected ? 'Önce bağlanmalı' : googleActivationBlocked ? 'Önce Google hesabı ve işletme konumu seçilmeli' : platform.enabled ? 'Pasife al' : 'Aktife al'} label={isBusy ? 'İşleniyor…' : platform.enabled ? 'Pasifleştir' : 'Aktifleştir'} icon={Power} variant={platform.enabled ? 'deactivate' : 'activate'} className="ml-auto" />
              </div>
              {googleActivationBlocked && (
                <p style={{ color: '#B45309', fontFamily: 'Inter, sans-serif', fontSize: 10, margin: '7px 0 0', lineHeight: 1.45 }}>
                  Aktifleştirmek için önce aşağıdan Google hesabı ve işletme konumu seçin.
                </p>
              )}
              {platform.key === 'x' && (
                <div style={{ marginTop: 10 }}>
                  {latestBlog ? (
                    <XShareButton
                      title={latestBlog.title}
                      summary={latestBlog.summary}
                      url={latestBlog.url}
                      label="Son yayınlanan yazıyı X'te paylaş"
                      style={{ width: '100%', background: '#172B3A', borderColor: '#172B3A' }}
                    />
                  ) : (
                    <p style={{ margin: 0, color: '#64748B', fontFamily: 'Inter, sans-serif', fontSize: 11 }}>
                      Manuel paylaşım için önce bir blog yazısı yayımlayın.
                    </p>
                  )}
                </div>
              )}
              {platform.key === 'facebook' && (
                <div style={{ marginTop: 10 }}>
                  {latestBlog ? (
                    <FacebookShareButton
                      url={latestBlog.url}
                      label="Son yayınlanan yazıyı Facebook'ta paylaş"
                      style={{ width: '100%' }}
                    />
                  ) : (
                    <p style={{ margin: 0, color: '#64748B', fontFamily: 'Inter, sans-serif', fontSize: 11 }}>
                      Manuel paylaşım için önce bir blog yazısı yayımlayın.
                    </p>
                  )}
                </div>
              )}
              {platform.key === 'linkedin' && (
                <div style={{ marginTop: 10 }}>
                  {latestBlog ? (
                    <LinkedInShareButton
                      url={latestBlog.url}
                      label="Son yayınlanan yazıyı LinkedIn'de paylaş"
                      style={{ width: '100%' }}
                    />
                  ) : (
                    <p style={{ margin: 0, color: '#64748B', fontFamily: 'Inter, sans-serif', fontSize: 11 }}>
                      Manuel paylaşım için önce bir blog yazısı yayımlayın.
                    </p>
                  )}
                </div>
              )}
              {platform.key === 'telegram' && (
                <div style={{ marginTop: 10 }}>
                  {latestBlog ? (
                    <TelegramShareButton
                      title={latestBlog.title}
                      url={latestBlog.url}
                      label="Son yayınlanan yazıyı Telegram'da paylaş"
                      style={{ width: '100%' }}
                    />
                  ) : (
                    <p style={{ margin: 0, color: '#64748B', fontFamily: 'Inter, sans-serif', fontSize: 11 }}>
                      Manuel paylaşım için önce bir blog yazısı yayımlayın.
                    </p>
                  )}
                </div>
              )}
              {(platform.key === 'tiktok' || platform.key === 'youtube') && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #E8EDF2' }}>
                  <label style={{ display: 'block', color: '#52697A', fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, marginBottom: 5 }}>
                    {platform.key === 'tiktok' ? 'TikTok profil veya video linki' : 'YouTube kanal veya video linki'}
                  </label>
                  <input
                    type="url"
                    value={platform.key === 'tiktok' ? profileLinks.tiktokUrl : profileLinks.youtubeUrl}
                    onChange={(event) => setProfileLinks((current) => ({
                      ...current,
                      [platform.key === 'tiktok' ? 'tiktokUrl' : 'youtubeUrl']: event.target.value,
                    }))}
                    placeholder={platform.key === 'tiktok' ? 'https://www.tiktok.com/@hesabiniz' : 'https://www.youtube.com/@kanaliniz'}
                    style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #CBD5E1', borderRadius: 7, padding: '7px 8px', color: '#172B3A', background: '#fff', fontSize: 11 }}
                  />
                   <AdminActionButton type="button" onClick={() => void saveProfileLink(platform.key === 'tiktok' ? 'tiktokUrl' : 'youtubeUrl')} disabled={busyKey === (platform.key === 'tiktok' ? 'tiktokUrl' : 'youtubeUrl')} loading={busyKey === (platform.key === 'tiktok' ? 'tiktokUrl' : 'youtubeUrl')} label={busyKey === (platform.key === 'tiktok' ? 'tiktokUrl' : 'youtubeUrl') ? 'Kaydediliyor…' : 'Linki Kaydet'} variant="save" className="w-full mt-2" />
                  <p style={{ margin: '7px 0 0', color: '#64748B', fontFamily: 'Inter, sans-serif', fontSize: 10, lineHeight: 1.4 }}>
                    Kaydedilen geçerli bağlantı footer&apos;da yeni sekmede gösterilir. Video platformları için otomatik paylaşım yapılmaz.
                  </p>
                </div>
              )}
              {platform.key === 'google_business' && platform.connected && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #E8EDF2' }}>
                  <p style={{ color: '#52697A', fontFamily: 'Inter, sans-serif', fontSize: 10, margin: '0 0 6px', lineHeight: 1.45 }}>
                    1. Hesap ve işletme konumunu seçin. 2. Kanalı aktifleştirin. 3. Gerçek yorumları senkronlayın.
                  </p>
                  {googleOptionsLoading ? (
                    <p style={{ color: '#52697A', fontFamily: 'Inter, sans-serif', fontSize: 10, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Hesap ve işletme konumları yükleniyor…
                    </p>
                  ) : googleOptionsError ? (
                    <div role="alert" style={{ color: '#991B1B', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, padding: '8px 9px', fontFamily: 'Inter, sans-serif', fontSize: 10, margin: '0 0 8px', lineHeight: 1.45 }}>
                      {googleOptionsError}
                    </div>
                  ) : googleLocations.length > 0 ? (
                    <select
                      value=""
                      onChange={(event) => {
                        if (event.target.value) void selectGoogleLocation(event.target.value);
                      }}
                      disabled={busyKey === 'google-business-location'}
                      style={{ width: '100%', border: '1px solid #CBD5E1', borderRadius: 7, padding: '7px 8px', color: '#172B3A', background: '#fff', fontSize: 11, marginBottom: 8 }}
                    >
                      <option value="">
                        {typeof connectionMeta.locationLabel === 'string'
                          ? `Seçili: ${connectionMeta.locationLabel}`
                          : 'İşletme konumu seçin'}
                      </option>
                      {googleLocations.map((location) => (
                        <option key={location.locationName} value={JSON.stringify(location)}>
                          {location.accountLabel} — {location.locationLabel}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p style={{ color: '#B45309', fontFamily: 'Inter, sans-serif', fontSize: 10, margin: '0 0 8px' }}>
                      Erişilebilir işletme konumu bulunamadı. Google hesabının işletme yöneticisi olduğundan emin olun.
                    </p>
                  )}
                  {googleFeedback && (
                    <div role={googleFeedback.type === 'error' ? 'alert' : 'status'} style={{ color: googleFeedback.type === 'error' ? '#991B1B' : '#14532D', background: googleFeedback.type === 'error' ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${googleFeedback.type === 'error' ? '#FECACA' : '#BBF7D0'}`, borderRadius: 7, padding: '8px 9px', fontFamily: 'Inter, sans-serif', fontSize: 10, margin: '0 0 8px', lineHeight: 1.45 }}>
                      {googleFeedback.text}
                    </div>
                  )}
                   <AdminActionButton type="button" onClick={() => void syncGoogleReviews()} disabled={!connectionMeta.locationName || busyKey === 'google-business-sync'} loading={busyKey === 'google-business-sync'} label={busyKey === 'google-business-sync' ? 'Yorumlar alınıyor…' : 'Google Yorumlarını Senkronla'} variant="save" className="w-full" />
                  {typeof connectionMeta.lastReviewSyncAt === 'string' && (
                    <p style={{ color: '#64748B', fontFamily: 'Inter, sans-serif', fontSize: 10, margin: '7px 0 0' }}>
                      Son senkronizasyon: {new Date(connectionMeta.lastReviewSyncAt).toLocaleString('tr-TR')}
                    </p>
                  )}
                  {platform.enabled && (
                    <p style={{ color: '#168C5B', fontFamily: 'Inter, sans-serif', fontSize: 10, margin: '5px 0 0' }}>
                      Otomatik senkronizasyon açık — zamanlayıcı saatte bir mevcut OAuth bağlantısıyla kontrol eder.
                    </p>
                  )}
                </div>
              )}
              {(['facebook', 'instagram', 'x', 'google_business'].includes(platform.key) && platform.connected && platform.enabled) && (
                <AdminActionButton onClick={() => void testLatestBlog(platform)} disabled={busyKey === `${platform.key}-test`} loading={busyKey === `${platform.key}-test`} label={busyKey === `${platform.key}-test` ? 'Gönderiliyor…' : 'Yayınlanmış Blogla Test Paylaşımı Yap'} icon={Send} variant="subtle" manage={false} className="w-full mt-2" />
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