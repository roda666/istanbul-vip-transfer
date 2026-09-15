import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { adminSectionGrants } from '@/db/schema';
import {
  resolveAdminCapabilities,
  type AdminCapabilities,
  type AdminGrant,
  type AdminRole,
} from './authorization';

export async function getAdminGrants(adminUserId: string): Promise<AdminGrant[]> {
  const rows = await db
    .select({
      section: adminSectionGrants.section,
      canView: adminSectionGrants.canView,
      canManage: adminSectionGrants.canManage,
    })
    .from(adminSectionGrants)
    .where(eq(adminSectionGrants.adminUserId, adminUserId));
  return rows;
}

export async function getAdminCapabilities(
  adminUserId: string,
  role: AdminRole | string,
): Promise<AdminCapabilities> {
  return resolveAdminCapabilities(role, await getAdminGrants(adminUserId));
}

export function normalizeAdminGrant(grant: { section: string; canView?: boolean; canManage?: boolean }): AdminGrant {
  const canManage = !!grant.canManage;
  return { section: grant.section, canView: !!grant.canView || canManage, canManage };
}

export function grantChanged(
  before: AdminGrant | undefined,
  after: AdminGrant,
): boolean {
  return before?.canView !== after.canView || before?.canManage !== after.canManage;
}
