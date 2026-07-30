import type { Metadata } from 'next';
import { getHomepageAdminRecord } from '@/lib/homepage-cms';
import HomepageEditor from './_HomepageEditor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ana Sayfa Düzenleyici | Admin',
  robots: { index: false, follow: false },
};

export default async function HomepageAdminPage() {
  // Pre-load Turkish source record for fast initial render
  const trRecord = await getHomepageAdminRecord('tr');

  return (
    <div style={{ padding: '28px 24px' }}>
      <HomepageEditor initialTrRecord={trRecord} />
    </div>
  );
}
