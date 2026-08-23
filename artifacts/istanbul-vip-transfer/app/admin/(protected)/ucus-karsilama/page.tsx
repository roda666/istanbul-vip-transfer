import type { Metadata } from 'next';
import AdminPageHeader from '../../_components/AdminPageHeader';
import FlightMeetGreetClient from './_FlightMeetGreetClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Uçuşla Karşılama | Admin',
  robots: { index: false },
};

export default function FlightMeetGreetPage() {
  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="Uçuşla Karşılama"
        description="Uçuş bilgisi doğrulama altyapısının güvenli hazırlık durumu"
        action={null}
      />
      <FlightMeetGreetClient />
    </div>
  );
}