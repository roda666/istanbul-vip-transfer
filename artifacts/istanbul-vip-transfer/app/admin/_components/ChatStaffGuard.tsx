'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Client component that enforces role-based routing for CHAT_STAFF.
 * CHAT_STAFF users can access live chat and their own account page.
 * Rendered inside the protected admin layout.
 */
export function ChatStaffGuard({ role }: { role: string }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const canAccess = pathname.startsWith('/admin/sohbet') || pathname.startsWith('/admin/hesabim');
    if (role === 'CHAT_STAFF' && !canAccess) {
      router.replace('/admin/sohbet');
    }
  }, [role, pathname, router]);

  return null;
}
