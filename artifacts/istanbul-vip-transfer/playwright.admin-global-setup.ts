import { cleanupAdminAcceptanceAccounts } from './scripts/cleanup-admin-acceptance';

export default async function globalSetup() {
  await cleanupAdminAcceptanceAccounts();
}