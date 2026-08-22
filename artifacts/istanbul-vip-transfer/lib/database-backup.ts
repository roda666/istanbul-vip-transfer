import 'server-only';
import type { ChildProcess } from 'node:child_process';

type DumpProcess = Pick<ChildProcess, 'exitCode' | 'killed' | 'kill' | 'once' | 'removeListener' | 'stdout'>;
type Schedule = (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;

export function stopDatabaseDump(
  child: Pick<DumpProcess, 'exitCode' | 'killed' | 'kill'>,
  schedule: Schedule = setTimeout,
) {
  if (child.exitCode !== null || child.killed) return;
  child.kill('SIGTERM');
  schedule(() => {
    if (child.exitCode === null && !child.killed) child.kill('SIGKILL');
  }, 5_000);
}

/**
 * Confirms the OS process has started without exposing child-process errors,
 * which can include database connection details.
 */
export function waitForDatabaseDumpStart(
  child: Pick<DumpProcess, 'once' | 'removeListener'>,
  timeoutMs = 10_000,
  schedule: Schedule = setTimeout,
) {
  return new Promise<void>((resolve, reject) => {
    const onSpawn = () => settle(resolve);
    const onError = () => settle(() => reject(new Error('database_dump_spawn_failed')));
    const timer = schedule(() => settle(() => reject(new Error('database_dump_spawn_timeout'))), timeoutMs);

    function settle(action: () => void) {
      clearTimeout(timer);
      child.removeListener('spawn', onSpawn);
      child.removeListener('error', onError);
      action();
    }

    child.once('spawn', onSpawn);
    child.once('error', onError);
  });
}

export function stopDatabaseDumpOnAbort(
  signal: AbortSignal,
  child: Pick<DumpProcess, 'exitCode' | 'killed' | 'kill'>,
) {
  const onAbort = () => stopDatabaseDump(child);
  signal.addEventListener('abort', onAbort, { once: true });
  return () => signal.removeEventListener('abort', onAbort);
}

export function getDatabaseDumpOutput(child: Pick<DumpProcess, 'stdout'>) {
  if (!child.stdout) throw new Error('database_dump_stdout_unavailable');
  return child.stdout;
}