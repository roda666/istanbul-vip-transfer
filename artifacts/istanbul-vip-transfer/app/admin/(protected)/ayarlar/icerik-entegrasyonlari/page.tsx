/**
 * /admin/ayarlar/icerik-entegrasyonlari
 * Content integration settings: Google Search Console OAuth + keyword data provider + OpenAI.
 */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle, CheckCircle2, Search, Cpu,
  BarChart2,
} from 'lucide-react';
import AdminPageHeader from '../../../_components/AdminPageHeader';
import DisconnectGscButton from './DisconnectGscButton';

export const metadata: Metadata = { title: 'İçerik Entegrasyonları | Admin', robots: { index: false } };
export const dynamic = 'force-dynamic';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getGscStatus(): Promise<{
  connected: boolean;
  email?: string | null;
  siteUrl?: string;
  error?: string;
}> {
  const hasCredentials = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  if (!hasCredentials) return { connected: false };
  try {
    const { isGscConnected, getGscConnection } = await import('@/lib/gsc');
    const connected = await isGscConnected();
    if (!connected) return { connected: false };
    const conn = await getGscConnection();
    return { connected: true, email: conn?.connectedEmail, siteUrl: conn?.siteUrl };
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : 'Hata' };
  }
}

async function getTopOpportunities() {
  try {
    const { isGscConnected, findKeywordOpportunities } = await import('@/lib/gsc');
    if (!(await isGscConnected())) return null;
    const result = await findKeywordOpportunities(5);
    return result.ok ? result.opportunities : null;
  } catch { return null; }
}

// ── Styles (shared) ───────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#FFFFFF', border: '1px solid #E2E8F0',
  borderRadius: '12px', overflow: 'hidden', marginBottom: '20px',
};
const cardHead: React.CSSProperties = {
  padding: '16px 20px', borderBottom: '1px solid #E8EDF2',
  display: 'flex', alignItems: 'center', gap: '10px',
};
const headTitle: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 700, color: '#172B3A', margin: 0,
};
const row: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px',
  padding: '16px 20px', borderBottom: '1px solid #E8EDF2',
};
const labelStyle: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600, color: '#172B3A',
  margin: '0 0 4px',
};
const hint: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#52697A', margin: '0 0 8px',
};
const codePill = (s: string) => (
  <code key={s} style={{ fontSize: '10px', background: '#F1F5F9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', marginRight: '4px' }}>
    {s}
  </code>
);
function StatusBadge({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap',
      padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
      fontFamily: 'Inter, sans-serif',
      background: ok ? '#F0FDF4' : '#FFF7ED',
      color: ok ? '#168C5B' : '#D97706',
    }}>
      {ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
      {label ?? (ok ? 'Bağlı' : 'Bağlı Değil')}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function IcerikEntegrasyonlariPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const sp           = await searchParams;
  const gscStatus    = await getGscStatus();
  const opportunities = gscStatus.connected ? await getTopOpportunities() : null;

  const hasGscCredentials = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const openAiOk          = !!(process.env.OPENAI_API_KEY);
  const cronSecretOk      = !!(process.env.CRON_SECRET);

  const ERROR_MSGS: Record<string, string> = {
    missing_client_id:    'GOOGLE_CLIENT_ID tanımlı değil. Aşağıdaki talimatları izleyin.',
    missing_credentials:  'GOOGLE_CLIENT_ID veya GOOGLE_CLIENT_SECRET eksik.',
    invalid_state:        'Güvenlik doğrulaması başarısız (state uyuşmazlığı). Tekrar deneyin.',
    missing_code:         'Google yetkilendirme kodu alınamadı. Tekrar deneyin.',
    token_exchange_failed:'Token alışverişi başarısız. Credentials doğru mu?',
    no_refresh_token:     'Google refresh token döndürmedi. Consent ekranında "prompt=consent" gerekli (zaten ayarlı).',
    server_error:         'Sunucu hatası. Sunucu loglarını kontrol edin.',
    user_cancelled:       'Bağlantı kullanıcı tarafından iptal edildi.',
  };

  return (
    <div style={{ padding: '28px 24px', maxWidth: '860px' }}>
      <AdminPageHeader
        title="İçerik Entegrasyonları"
        description="Anahtar kelime verileri ve AI içerik üretimi için harici servis bağlantıları"
      />

      {/* Error / Success banners */}
      {sp.error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <AlertCircle size={16} color="#D64545" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#991B1B', margin: 0 }}>
            {ERROR_MSGS[sp.error] ?? `Hata: ${sp.error}`}
          </p>
        </div>
      )}
      {sp.success === 'gsc_connected' && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <CheckCircle2 size={16} color="#168C5B" />
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#14532D', margin: 0 }}>
            Google Search Console başarıyla bağlandı! Site verileri artık AI Studio&apos;da kullanılacak.
          </p>
        </div>
      )}

      {/* ── Google Search Console ───────────────────────────────────────── */}
      <div style={card}>
        <div style={cardHead}>
          <Search size={18} color="#2563EB" />
          <h2 style={headTitle}>Google Search Console</h2>
          <StatusBadge ok={gscStatus.connected} />
        </div>

        {!hasGscCredentials ? (
          /* Credentials not configured — show setup instructions */
          <div style={{ padding: '20px' }}>
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '16px 18px', marginBottom: '20px' }}>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#92400E', margin: '0 0 10px', fontWeight: 600 }}>
                ⚠️ OAuth credentials henüz tanımlı değil. Aşağıdaki adımları izleyin:
              </p>
              <ol style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#78350F', margin: 0, paddingLeft: '20px', lineHeight: 1.7 }}>
                <li><a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" style={{ color: '#2563EB' }}>Google Cloud Console</a>&#39;a gidin → Proje oluşturun (örn. &ldquo;Istanbul VIP GSC&rdquo;)</li>
                <li><strong>APIs &amp; Services → Enable APIs</strong> → &ldquo;Google Search Console API&rdquo; etkinleştirin</li>
                <li><strong>APIs &amp; Services → Credentials → Create Credentials → OAuth 2.0 Client ID</strong></li>
                <li>Application type: <strong>Web application</strong></li>
                <li>Authorized redirect URIs ekleyin:<br />
                  <code style={{ fontSize: '12px', background: '#F1F5F9', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>
                    https://[sitenizin-domain]/api/auth/gsc/callback
                  </code>
                </li>
                <li>Client ID ve Secret&apos;ı kopyalayın → Replit Secrets&apos;a ekleyin:</li>
              </ol>
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {codePill('GOOGLE_CLIENT_ID')}
                {codePill('GOOGLE_CLIENT_SECRET')}
              </div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#78350F', margin: '10px 0 0' }}>
                Secrets ekledikten sonra sayfayı yenileyin. &ldquo;OAuth ile Bağlan&rdquo; butonu görünecek.
              </p>
            </div>
            <p style={hint}>
              Search Console, sitenizde hangi sorgularda gösterildiğinizi, tıklama oranlarını ve ortalama pozisyonları gösterir. AI Studio bu verileri haftalık taslak konu seçimi için kullanır.
            </p>
          </div>
        ) : gscStatus.connected ? (
          /* Connected state */
          <div>
            <div style={row}>
              <div>
                <p style={labelStyle}>Bağlı Hesap</p>
                <p style={{ ...hint, margin: 0 }}>{gscStatus.email ?? '—'}</p>
              </div>
              <StatusBadge ok label="Aktif" />
            </div>
            <div style={row}>
              <div>
                <p style={labelStyle}>Site</p>
                <p style={{ ...hint, margin: 0 }}>{gscStatus.siteUrl ?? '—'}</p>
              </div>
            </div>

            {/* Top opportunities */}
            {opportunities && opportunities.length > 0 && (
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #E8EDF2' }}>
                <p style={{ ...labelStyle, marginBottom: '12px' }}>
                  🎯 En İyi İçerik Fırsatları (son 90 gün)
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                        {['Arama Sorgusu', 'Gösterim', 'Tıklama', 'CTR', 'Pozisyon', 'Fırsat'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: '#52697A', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {opportunities.map((op, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 8px', color: '#172B3A', fontWeight: 500, maxWidth: '220px' }}>{op.query}</td>
                          <td style={{ padding: '8px 8px', color: '#334155' }}>{op.impressions.toLocaleString('tr-TR')}</td>
                          <td style={{ padding: '8px 8px', color: '#334155' }}>{op.clicks.toLocaleString('tr-TR')}</td>
                          <td style={{ padding: '8px 8px', color: op.ctr < 0.03 ? '#D64545' : '#168C5B', fontWeight: 600 }}>
                            %{(op.ctr * 100).toFixed(1)}
                          </td>
                          <td style={{ padding: '8px 8px', color: op.position > 10 ? '#D97706' : '#334155' }}>
                            #{op.position.toFixed(1)}
                          </td>
                          <td style={{ padding: '8px 8px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '10px', background: op.reason === 'low_ctr' ? '#EFF6FF' : '#FFF7ED', color: op.reason === 'low_ctr' ? '#2563EB' : '#D97706' }}>
                              {op.reason === 'low_ctr' ? 'Düşük CTR' : op.reason === 'low_position' ? 'Pozisyon' : 'Yüksek Gösterim'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ padding: '16px 20px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Link href="/api/auth/gsc" style={{ textDecoration: 'none' }}>
                <button style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #D8E1E9', background: '#F3F6FA', color: '#172B3A', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
                  Yeniden Bağlan
                </button>
              </Link>
              <form action="/admin/api/gsc/insights" method="post">
                <input type="hidden" name="_method" value="DELETE" />
                {/* Client-side disconnect handled via API */}
              </form>
              <DisconnectGscButton />
            </div>
          </div>
        ) : (
          /* Not connected — show connect button */
          <div style={{ padding: '20px' }}>
            <p style={hint}>
              Google hesabınızla Search Console&apos;a bağlanın. Sistem, sitenizin gerçek arama verilerini kullanarak içerik boşluklarını tespit edecek.
            </p>
            <p style={{ ...hint, marginBottom: '16px' }}>
              Scope: <code style={{ fontSize: '11px', background: '#F1F5F9', padding: '2px 5px', borderRadius: '4px' }}>webmasters.readonly</code> — yalnızca okuma yetkisi, site verinize yazamaz.
            </p>
            <Link href="/api/auth/gsc" style={{ textDecoration: 'none' }}>
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
                <Search size={15} />
                Google ile Bağlan (Search Console)
              </button>
            </Link>
          </div>
        )}
      </div>

      {/* ── OpenAI ─────────────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={cardHead}>
          <Cpu size={18} color={openAiOk ? '#168C5B' : '#D97706'} />
          <h2 style={headTitle}>OpenAI (AI İçerik Üretimi)</h2>
          <StatusBadge ok={openAiOk} />
        </div>
        <div style={row}>
          <div>
            <p style={labelStyle}>Durum</p>
            <p style={hint}>{openAiOk ? 'API key tanımlı. Araştırma, taslak üretimi ve çeviri aktif.' : 'OPENAI_API_KEY Replit Secret\'ı eksik. AI Studio çalışmaz.'}</p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{codePill('OPENAI_API_KEY')}</div>
          </div>
          <StatusBadge ok={openAiOk} />
        </div>
        <div style={{ ...row, borderBottom: 'none' }}>
          <div>
            <p style={labelStyle}>Kullanılan Model</p>
            <p style={{ ...hint, margin: 0 }}>
              {process.env.OPENAI_CONTENT_MODEL ?? process.env.OPENAI_TRANSLATION_MODEL ?? 'gpt-5.4-mini'} (varsayılan)
            </p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>{codePill('OPENAI_CONTENT_MODEL')}</div>
          </div>
        </div>
      </div>

      {/* ── Haftalık Cron ─────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={cardHead}>
          <BarChart2 size={18} color={cronSecretOk ? '#168C5B' : '#D97706'} />
          <h2 style={headTitle}>Haftalık Otomatik Taslak</h2>
          <StatusBadge ok={cronSecretOk} label={cronSecretOk ? 'Secret Hazır' : 'Secret Eksik'} />
        </div>
        <div style={row}>
          <div style={{ flex: 1 }}>
            <p style={labelStyle}>Cron Secret</p>
            <p style={hint}>Haftalık cron endpoint&apos;ini korumak için gerekli. Replit Secrets&apos;a ekleyin:</p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{codePill('CRON_SECRET')}</div>
          </div>
          <StatusBadge ok={cronSecretOk} />
        </div>
        <div style={{ ...row, borderBottom: 'none' }}>
          <div style={{ flex: 1 }}>
            <p style={labelStyle}>Cron Endpoint</p>
            <p style={hint}>Her Pazartesi bu URL&apos;ye POST isteği gönderecek bir zamanlayıcı kurun:</p>
            <code style={{ fontSize: '12px', background: '#F1F5F9', color: '#334155', padding: '8px 12px', borderRadius: '6px', display: 'block', marginBottom: '8px', wordBreak: 'break-all' }}>
              POST /admin/api/cron/weekly-draft
            </code>
            <p style={hint}>Header: <code style={{ fontSize: '11px', background: '#F1F5F9', padding: '2px 5px', borderRadius: '4px' }}>Authorization: Bearer {'<CRON_SECRET>'}</code></p>
            <p style={{ ...hint, marginBottom: 0 }}>Replit Scheduled Deployment veya harici bir cron servisi (cron-job.org, GitHub Actions) kullanabilirsiniz.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

