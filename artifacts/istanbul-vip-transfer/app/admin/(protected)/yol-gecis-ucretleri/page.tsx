import type { Metadata } from 'next';
import { Navigation } from 'lucide-react';
import AdminPageHeader from '../../_components/AdminPageHeader';
import TollManagementClient from './_TollManagementClient';

export const metadata: Metadata = {
  title: 'Yol & Geçiş Ücretleri | Admin',
  robots: { index: false },
};

export default function TollManagementPage() {
  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="Yol & Geçiş Ücretleri"
        description="Köprü, tünel ve otoyol maliyetlerini araç sınıfı ile rota alternatifine göre yönetin"
        action={null}
      />
      <div
        style={{
          background: '#FFF7ED',
          border: '1px solid #FED7AA',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '24px',
          color: '#9A3412',
          fontSize: '13px',
          fontFamily: 'Inter, sans-serif',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Navigation size={14} />
        Eksik araç sınıfı tarifesi olan geçişler fiyattan hiç etkilenmez (asla 0 TL varsayılmaz); teklif yine üretilir ama "eksik veri" olarak işaretlenir ve panelde vurgulanır. Manuel değerler her zaman otomatik kaynaktan önceliklidir. Belirlenen eşiği aşan veya yeni takvim yılına giren tarifeler "bayat" olarak uyarılır (Ayarlar sekmesinden yapılandırılabilir).
      </div>
      <TollManagementClient />
    </div>
  );
}