/**
 * /admin/diller — Language management page.
 * Allows enabling/disabling target languages, setting display order, and changing the default.
 */
import type { Metadata } from 'next';
import { db } from '@/db';
import { languages } from '@/db/schema';
import { asc } from 'drizzle-orm';
import AdminPageHeader from '../../_components/AdminPageHeader';
import DillerClient from './_DillerClient';

export const metadata: Metadata = { title: 'Dil Yönetimi | Admin', robots: { index: false } };

export default async function DillerPage() {
  let langs: (typeof languages.$inferSelect)[] = [];
  let dbError = false;

  try {
    langs = await db.select().from(languages).orderBy(asc(languages.displayOrder));
  } catch {
    dbError = true;
  }

  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="Dil Yönetimi"
        description="Sitede aktif dilleri, görüntüleme sırasını ve metin yönünü yönetin"
      />
      {dbError ? (
        <p style={{ color: '#f87171', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
          Veritabanı bağlantı hatası. Migration çalıştırıldı mı?
        </p>
      ) : (
        <DillerClient langs={langs} />
      )}
    </div>
  );
}
