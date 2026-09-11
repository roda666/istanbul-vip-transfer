import { cleanupAdminAcceptanceAccounts } from './scripts/cleanup-admin-acceptance';

export default async function globalTeardown() {
  await cleanupAdminAcceptanceAccounts();
}