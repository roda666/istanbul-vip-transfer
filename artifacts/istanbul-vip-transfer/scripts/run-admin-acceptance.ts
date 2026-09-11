import { spawn, type ChildProcess } from 'node:child_process';
import { cleanupAdminAcceptanceAccounts } from './cleanup-admin-acceptance';

let child: ChildProcess | undefined;
let receivedSignal: NodeJS.Signals | undefined;

function stopChildTree(signal: NodeJS.Signals) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    receivedSignal = signal;
    stopChildTree(signal);
  });
}

async function main() {
  await cleanupAdminAcceptanceAccounts();
  const forwardedArgs = process.argv.slice(2);
  if (forwardedArgs[0] === '--') forwardedArgs.shift();
  child = spawn(
    'pnpm',
    ['exec', 'playwright', 'test', '--config=playwright.admin.config.ts', ...forwardedArgs],
    { stdio: 'inherit', env: process.env, detached: true },
  );

  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child!.once('error', reject);
    child!.once('exit', (code, signal) => resolve({ code, signal }));
  });

  await cleanupAdminAcceptanceAccounts();
  if (receivedSignal || result.signal) return 128;
  return result.code ?? 1;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch(async (error) => {
    console.error('Admin acceptance runner failed.');
    console.error(error instanceof Error ? error.message : 'Unknown runner error');
    await cleanupAdminAcceptanceAccounts().catch(() => {});
    process.exit(1);
  });