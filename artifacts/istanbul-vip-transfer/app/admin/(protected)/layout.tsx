import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AdminSidebar from '../_components/AdminSidebar';
import { ChatStaffGuard } from '../_components/ChatStaffGuard';

// All admin pages are dynamic — they require authenticated sessions via cookies.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Belt-and-suspenders auth check (middleware is primary guard).
  let sessionData = null;
  try {
    const { requireAdminSession } = await import('@/lib/auth/session');
    const session = await requireAdminSession();
    sessionData = { name: session.name, email: session.email, role: session.role };
  } catch {
    // Middleware and this layout both enforce the current active session.
  }

  if (!sessionData) {
    redirect('/admin/login');
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        minWidth: 0,
        maxWidth: '100%',
        overflowX: 'clip',
        background: '#F3F6FA',
      }}
    >
      <ChatStaffGuard role={sessionData.role} />
      <AdminSidebar
        userName={sessionData.name}
        userEmail={sessionData.email}
        userRole={sessionData.role}
      />
      {/* Main content area */}
      <div
        style={{
          flex: 1,
          flexBasis: 0,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          maxWidth: '100%',
          overflow: 'hidden',
        }}
      >
        <main
          style={{
            flex: 1,
            minWidth: 0,
            maxWidth: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '0',
          }}
        >
          {/*
           * Mobile header clearance.
           * The mobile top bar is position:fixed (56 px). On mobile the sidebar
           * fragment's offset-div is a flex item in the horizontal row and gives
           * no vertical clearance to this column.  This single spacer, placed
           * once here in the shared layout, pushes all page content below the
           * header on every protected admin page.  Hidden on lg+ (desktop uses
           * a sticky sidebar with no fixed header).
           */}
          <div className="lg:hidden" style={{ height: '56px', flexShrink: 0 }} aria-hidden="true" />
          {children}
        </main>
      </div>
    </div>
  );
}
