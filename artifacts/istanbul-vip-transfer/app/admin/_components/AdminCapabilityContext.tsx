'use client';

import { createContext, useContext } from 'react';
import type { AdminCapabilities } from '@/lib/auth/authorization';
import { getAdminSectionForPath } from '@/lib/auth/authorization';
import { usePathname } from 'next/navigation';

export const AdminCapabilityContext = createContext<AdminCapabilities | null>(null);

export function AdminCapabilityProvider({
  capabilities,
  children,
}: { capabilities: AdminCapabilities; children: React.ReactNode }) {
  const pathname = usePathname();
  const section = pathname ? getAdminSectionForPath(pathname) : undefined;
  const readOnly = !!section && !capabilities[section].canManage;
  return (
    <AdminCapabilityContext.Provider value={capabilities}>
      {readOnly && <style>{'[data-admin-action="manage"]{display:none!important}'}</style>}
      {children}
    </AdminCapabilityContext.Provider>
  );
}

/** Read-only client hint for shared action buttons; APIs remain authoritative. */
export function useAdminCapabilities(): AdminCapabilities {
  const value = useContext(AdminCapabilityContext);
  if (!value) throw new Error('AdminCapabilityProvider is missing');
  return value;
}

export function useOptionalAdminCapabilities(): AdminCapabilities | null {
  return useContext(AdminCapabilityContext);
}

export function useAdminCapability(section: keyof AdminCapabilities, mode: 'view' | 'manage' = 'view'): boolean {
  const capability = useAdminCapabilities()[section];
  return mode === 'manage' ? capability.canManage : capability.canView;
}
