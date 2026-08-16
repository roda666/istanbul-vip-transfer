'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Client component that enforces role-based routing for CHAT_STAFF.
 * CHAT_STAFF users can only access /admin/sohbet.
 * Rendered inside the protected admin layout.
 */
export function ChatStaffGuard({ role }: { role: string }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (role === 'CHAT_STAFF' && !pathname.startsWith('/admin/sohbet')) {
      router.replace('/admin/sohbet');
    }
  }, [role, pathname, router]);

  return null;
}
