import { spawn, type ChildProcess } from 'node:child_process';
import { access } from 'node:fs/promises';
import { cleanupAdminAcceptanceAccounts } from './cleanup-admin-acceptance';

let child: ChildProcess | undefined;
let server: ChildProcess | undefined;
let receivedSignal: NodeJS.Signals | undefined;

function stopChildTree(signal: NodeJS.Signals) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
  if (server?.pid) {
    try { process.kill(-server.pid, signal); } catch { server.kill(signal); }
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
  const port = process.env.PORT ?? '26004';
  const baseURL = process.env.BASE_URL ?? `http://127.0.0.1:${port}`;
  const serverMode = process.env.ADMIN_ACCEPTANCE_SERVER ?? 'production';
  const env = { ...process.env, PORT: port, BASE_URL: baseURL, ADMIN_ACCEPTANCE_TEST: '1' };

  if (serverMode === 'production') {
    await access('.next/BUILD_ID').catch(() => {
      throw new Error('Admin acceptance production mode requires a completed `pnpm build` (.next/BUILD_ID missing).');
    });
    server = spawn(
      'pnpm',
      ['exec', 'next', 'start', '--hostname', '127.0.0.1', '--port', port],
      { stdio: 'inherit', env, detached: true },
    );
    await waitForServer(baseURL);
  }

  child = spawn('pnpm', ['exec', 'playwright', 'test', '--config=playwright.admin.config.ts', ...forwardedArgs], {
    stdio: 'inherit',
    env,
    detached: true,
  });

  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child!.once('error', reject);
    child!.once('exit', (code, signal) => resolve({ code, signal }));
  });

  await cleanupAdminAcceptanceAccounts();
  if (server?.pid) {
    try { process.kill(-server.pid, 'SIGTERM'); } catch { server.kill('SIGTERM'); }
    server = undefined;
  }
  if (receivedSignal || result.signal) return 128;
  return result.code ?? 1;
}

async function waitForServer(baseURL: string) {
  const deadline = Date.now() + 30_000;
  let lastError = 'unknown error';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseURL}/admin/login`, { redirect: 'manual' });
      if (response.status > 0) return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Admin acceptance server did not become ready at ${baseURL}: ${lastError}`);
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch(async (error) => {
    console.error('Admin acceptance runner failed.');
    console.error(error instanceof Error ? error.message : 'Unknown runner error');
    if (server?.pid) {
      try { process.kill(-server.pid, 'SIGTERM'); } catch { server.kill('SIGTERM'); }
    }
    await cleanupAdminAcceptanceAccounts().catch(() => {});
    process.exit(1);
  });