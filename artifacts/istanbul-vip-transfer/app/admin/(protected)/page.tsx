import { redirect } from 'next/navigation';

/** /admin → /admin/dashboard */
export default function AdminRootPage() {
  redirect('/admin/dashboard');
}
