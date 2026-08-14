/**
 * /admin/ayarlar/icerik-entegrasyonlari
 * Content integration settings: Google Search Console + keyword data provider.
 * Currently stub — "not connected" state. Secrets read from Replit Secrets via env vars.
 */
import type { Metadata } from 'next';
import AdminPageHeader from '../../../_components/AdminPageHeader';
import { AlertCircle, CheckCircle2, ExternalLink, Database, Search } from 'lucide-react';

export const metadata: Metadata = { title: 'İçerik Entegrasyonları | Admin', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** KeywordDataProvider interface — swap implementation when a real provider connects. */
// interface KeywordDataProvider {
//   name: string;
//   isConnected: () => Promise<boolean>;
//   getKeywordVolume: (keyword: string, locale: string) => Promise<{ volume: number | null; competition: number | null }>;
//   getSearchRankings: (url: string) => Promise<Array<{ query: string; position: number }>>;
// }

function getGscConnected() {
  return !!(process.env.GSC_CLIENT_ID && process.env.GSC_CLIENT_SECRET && process.env.GSC_REFRESH_TOKEN);
}
function getKeywordProviderConnected() {
  return !!(process.env.KEYWORD_PROVIDER_API_KEY);
}
function getOpenAiConnected() {
  return !!(process.env.OPENAI_API_KEY);
}

function StatusRow({
  label, connected, hint, secretNames,
}: { label: string; connected: boolean; hint: string; secretNames: string[] }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px',
      padding: '16px 20px', borderBottom: '1px solid #E8EDF2',
    }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600, color: '#172B3A', margin: '0 0 4px' }}>{label}</p>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#52697A', margin: '0 0 6px' }}>{hint}</p>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {secretNames.map(s => (
            <code key={s} style={{ fontSize: '10px', background: '#F1F5F9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>{s}</code>
          ))}
        </div>
      </div>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap',
        padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
        fontFamily: 'Inter, sans-serif',
        background: connected ? '#F0FDF4' : '#FFF7ED',
        color: connected ? '#168C5B' : '#D97706',
      }}>
        {connected ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
        {connected ? 'Bağlı' : 'Bağlı Değil'}
      </span>
    </div>
  );
}

export default async function ContentIntegrationsPage() {
  const gscConnected     = getGscConnected();
  const kwConnected      = getKeywordProviderConnected();
  const openAiConnected  = getOpenAiConnected();

  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="İçerik Entegrasyonları"
        description="Google Search Console, anahtar kelime ve AI sağlayıcısı bağlantı durumu"
      />

      {/* Notice banner */}
      <div style={{
        display: 'flex', gap: '10px', padding: '14px 16px', borderRadius: '10px', marginBottom: '24px',
        background: '#EFF6FF', border: '1px solid #BFDBFE',
      }}>
        <AlertCircle size={16} style={{ color: '#2563EB', flexShrink: 0, marginTop: '1px' }} />
        <div>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, color: '#1D4ED8', margin: '0 0 4px' }}>
            Entegrasyon bağlantısı yapılandırılmadı
          </p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#1E40AF', margin: 0 }}>
            Secret&apos;ları Replit Secrets panelinden ekleyin. Kod içinde API anahtarı saklanmaz.
            Bağlantı yapılmadan da AI içerik önerileri ve taslak üretimi kullanılabilir —
            sadece anahtar kelime hacim verisi ve GSC sıralama verisi gösterilmez.
          </p>
        </div>
      </div>

      {/* OpenAI */}
      <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', marginBottom: '20px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E8EDF2', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={16} style={{ color: '#52697A' }} />
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 700, color: '#172B3A', margin: 0 }}>
            AI İçerik Üretimi
          </p>
        </div>
        <StatusRow
          label="OpenAI API"
          connected={openAiConnected}
          hint="Konu önerisi, makale taslağı ve sosyal medya metinleri için gerekli. OPENAI_API_KEY eksikse AI özellikleri devre dışı kalır."
          secretNames={['OPENAI_API_KEY', 'OPENAI_CONTENT_MODEL (opsiyonel)']}
        />
      </div>

      {/* Google Search Console */}
      <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', marginBottom: '20px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E8EDF2', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={16} style={{ color: '#52697A' }} />
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 700, color: '#172B3A', margin: 0 }}>
            Google Search Console
          </p>
        </div>
        <StatusRow
          label="GSC OAuth"
          connected={gscConnected}
          hint="Sıralama verisi, tıklama ve gösterim raporu için. OAuth akışı bu arayüzden yapılmaz — servis hesabı ile entegre edin."
          secretNames={['GSC_CLIENT_ID', 'GSC_CLIENT_SECRET', 'GSC_REFRESH_TOKEN', 'GSC_SITE_URL']}
        />
      </div>

      {/* Keyword provider */}
      <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', marginBottom: '20px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E8EDF2', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={16} style={{ color: '#52697A' }} />
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 700, color: '#172B3A', margin: 0 }}>
            Anahtar Kelime Veri Sağlayıcısı
          </p>
        </div>
        <StatusRow
          label="Keyword API"
          connected={kwConnected}
          hint="Arama hacmi ve rekabet skoru için. Bağlı değilken AI önerileri hacim/sıralama tahmini yapamaz — bu bilgi açıkça gösterilir, uydurulmaz."
          secretNames={['KEYWORD_PROVIDER_API_KEY', 'KEYWORD_PROVIDER_NAME (opsiyonel)']}
        />
        <div style={{ padding: '14px 20px' }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#52697A', margin: 0 }}>
            <strong>Desteklenen sağlayıcılar (yer tutucu arayüz):</strong>{' '}
            Ahrefs, SEMrush, DataForSEO, Moz — bağlantı yapılmadan stub &quot;Bağlı değil&quot; döndürür.
          </p>
        </div>
      </div>

      {/* Security note */}
      <div style={{ padding: '14px 16px', borderRadius: '10px', background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#166534', margin: 0 }}>
          🔒 <strong>Güvenlik:</strong> API anahtarları yalnızca sunucu taraflı okunur.
          Client bundle&apos;a sızmaz. Lütfen secret değerlerini bu sayfada görüntülemeyin.
          <a href="https://docs.replit.com/replit-workspace/secrets-management" target="_blank" rel="noreferrer"
            style={{ color: '#15803D', marginLeft: '6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            Replit Secrets Yönetimi <ExternalLink size={10} />
          </a>
        </p>
      </div>
    </div>
  );
}
