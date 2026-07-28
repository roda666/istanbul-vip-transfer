import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AdminSidebar from '../_components/AdminSidebar';

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
  // Dynamically import to avoid issues when AUTH_SECRET is missing.
  let sessionData = null;
  try {
    const { getSession } = await import('@/lib/auth/session');
    const session = await getSession();
    if (session.isLoggedIn && session.adminId) {
      // Verify sessionVersion to invalidate sessions superseded by a password change
      const { db } = await import('@/db');
      const { adminUsers } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      const [user] = await db
        .select({ sessionVersion: adminUsers.sessionVersion, active: adminUsers.active })
        .from(adminUsers)
        .where(eq(adminUsers.id, session.adminId))
        .limit(1);
      if (user && user.active && user.sessionVersion === session.sessionVersion) {
        sessionData = { name: session.name, email: session.email, role: session.role };
      }
    }
  } catch {
    // AUTH_SECRET not configured or invalid session
  }

  if (!sessionData) {
    redirect('/admin/login');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F3F6FA' }}>
      <AdminSidebar
        userName={sessionData.name}
        userEmail={sessionData.email}
        userRole={sessionData.role}
      />
      {/* Main content area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
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
