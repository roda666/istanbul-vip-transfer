import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import {
  getDatabaseDumpOutput,
  stopDatabaseDump,
  stopDatabaseDumpOnAbort,
  waitForDatabaseDumpStart,
} from '@/lib/database-backup';

function createChild() {
  const child = new EventEmitter() as EventEmitter & {
    exitCode: number | null;
    killed: boolean;
    kill: ReturnType<typeof vi.fn>;
    stdout: null;
  };
  child.exitCode = null;
  child.killed = false;
  child.kill = vi.fn();
  child.stdout = null;
  return child;
}

describe('database backup process lifecycle', () => {
  it('terminates an active dump, then force-kills only if it is still running', () => {
    vi.useFakeTimers();
    const child = createChild();

    stopDatabaseDump(child);
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');

    vi.advanceTimersByTime(5_000);
    expect(child.kill).toHaveBeenLastCalledWith('SIGKILL');
    vi.useRealTimers();
  });

  it('does not terminate an already completed dump', () => {
    const child = createChild();
    child.exitCode = 0;
    stopDatabaseDump(child);
    expect(child.kill).not.toHaveBeenCalled();
  });

  it('stops the dump when the downloading client disconnects', () => {
    const child = createChild();
    const controller = new AbortController();
    const removeAbortListener = stopDatabaseDumpOnAbort(controller.signal, child);

    controller.abort();
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    removeAbortListener();
  });

  it('rejects a startup error without exposing child-process details', async () => {
    const child = createChild();
    const started = waitForDatabaseDumpStart(child);
    child.emit('error', new Error('sensitive connection detail'));

    await expect(started).rejects.toThrow('database_dump_spawn_failed');
  });

  it('rejects a startup timeout and requires stdout for a stream response', async () => {
    vi.useFakeTimers();
    const child = createChild();
    const started = waitForDatabaseDumpStart(child, 1_000);
    vi.advanceTimersByTime(1_000);

    await expect(started).rejects.toThrow('database_dump_spawn_timeout');
    expect(() => getDatabaseDumpOutput(child)).toThrow('database_dump_stdout_unavailable');
    vi.useRealTimers();
  });
});