import { redirect } from 'next/navigation';

/** /admin → the role-appropriate first protected page. */
export default async function AdminRootPage() {
  const { requireAdminSession } = await import('@/lib/auth/session');
  const { getAdminRedirectPath } = await import('@/lib/admin/redirect');
  const session = await requireAdminSession();
  redirect(getAdminRedirectPath(session.role));
}
