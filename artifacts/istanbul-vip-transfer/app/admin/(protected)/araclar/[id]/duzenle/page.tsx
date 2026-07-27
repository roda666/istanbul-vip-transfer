import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { db } from '@/db';
import { vehicles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import AdminPageHeader from '../../../../_components/AdminPageHeader';
import VehicleForm from '../../_VehicleForm';

export const metadata: Metadata = {
  title: 'Araç Düzenle | Admin',
  robots: { index: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function AracDuzenlePage({ params }: Props) {
  const { id } = await params;
  const session = await requireAdminSession();

  const rows = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, id))
    .limit(1)
    .catch(() => []);

  const vehicle = rows[0];
  if (!vehicle) notFound();

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
        title={`Düzenle: ${vehicle.name}`}
        description={`Slug: ${vehicle.slug}`}
      />

      <VehicleForm vehicle={vehicle} userRole={session.role} />
    </div>
  );
}
