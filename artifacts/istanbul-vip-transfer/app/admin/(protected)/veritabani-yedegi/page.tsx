import { redirect } from 'next/navigation';
import { DatabaseBackup } from 'lucide-react';
import { requireAdminSession } from '@/lib/auth/session';
import DatabaseBackupClient from './_DatabaseBackupClient';

export const dynamic = 'force-dynamic';

export default async function VeritabaniYedegiPage() {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    redirect('/admin');
  }

  if (session.role !== 'SUPER_ADMIN') {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
        <p style={{ color: '#C0392B', fontSize: '15px' }}>Bu sayfaya erişim yetkiniz bulunmuyor.</p>
        <p style={{ color: '#52697A', fontSize: '13px', marginTop: '8px' }}>
          Veritabanı yedekleri yalnızca Süper Yöneticiler tarafından indirilebilir.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 24px', minHeight: '100vh', background: '#F3F6FA', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '720px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <DatabaseBackup size={25} color="#2563EB" />
          <h1 style={{ margin: 0, color: '#172B3A', fontSize: '23px' }}>Veritabanı Yedeği</h1>
        </div>
        <p style={{ margin: '0 0 24px', color: '#52697A', fontSize: '14px', lineHeight: 1.6 }}>
          Tam PostgreSQL yedeği güvenli bağlantı üzerinden doğrudan cihazınıza indirilir. Yedek dosyası sunucuda veya uygulama veritabanında saklanmaz.
        </p>

        <section style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(23,43,58,0.06)' }}>
          <h2 style={{ margin: '0 0 10px', fontSize: '16px', color: '#172B3A' }}>Yeni yedek indir</h2>
          <p style={{ margin: '0 0 18px', color: '#52697A', fontSize: '13px', lineHeight: 1.6 }}>
            Dosya PostgreSQL özel arşiv biçiminde (<code>.dump</code>) oluşturulur. İndirme sonunda aynı dosya için bir SHA-256 doğrulama manifesti de indirilir.
          </p>
          <DatabaseBackupClient />
        </section>

        <section style={{ marginTop: '18px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '15px', color: '#92400E' }}>Geri yükleme notu</h2>
          <p style={{ margin: 0, color: '#78350F', fontSize: '13px', lineHeight: 1.6 }}>
            Geri yükleme bu panelden yapılmaz. Önce indirdiğiniz SHA-256 manifestini ve <code>pg_restore --list</code> çıktısını doğrulayın; ardından yalnızca yetkili teknik ekip, hedef veritabanını ve erişim etkisini onayladıktan sonra <code>pg_restore</code> ile offline olarak uygular. Ayrıntılı adımlar <code>docs/DATABASE_BACKUP_RESTORE.md</code> dosyasındadır.
          </p>
        </section>
      </div>
    </div>
  );
}