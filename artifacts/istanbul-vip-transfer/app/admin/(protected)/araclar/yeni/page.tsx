import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { db } from '@/db';
import { tollPoints } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import AdminPageHeader from '../../../_components/AdminPageHeader';
import VehicleForm from '../_VehicleForm';

export const metadata: Metadata = {
  title: 'Yeni Araç | Admin',
  robots: { index: false },
};

export default async function YeniAracPage() {
  const session = await requireAdminSession();
  const activeTollPoints = await db.select().from(tollPoints).where(eq(tollPoints.active, true)).orderBy(asc(tollPoints.name));

  return (
    <div style={{ padding: '28px 24px' }}>
      <Link
        href="/admin/araclar"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: '#666',
          fontSize: '12px',
          fontFamily: 'Inter, sans-serif',
          textDecoration: 'none',
          marginBottom: '20px',
        }}
      >
        <ChevronLeft size={14} />
        Araçlara Dön
      </Link>

      <AdminPageHeader
        title="Yeni Araç Ekle"
        description="Araç bilgilerini doldurun ve taslak olarak kaydedin veya incelemeye gönderin."
      />

      <VehicleForm userRole={session.role} tollPoints={activeTollPoints} />
    </div>
  );
}
