/**
 * GET /admin/api/database-backup
 *
 * Streams a custom-format PostgreSQL dump directly to a SUPER_ADMIN browser.
 * The archive is intentionally never written to the workspace, object storage,
 * logs, or the application database. Restoration remains an offline operation.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { writeAdminSecurityAudit } from '@/lib/auth/audit';
import {
  DATABASE_BACKUP_CHECKSUM_ALGORITHM,
  DATABASE_BACKUP_SCHEMA_VERSION,
  getDatabaseDumpOutput,
  stopDatabaseDump,
  stopDatabaseDumpOnAbort,
  waitForDatabaseDumpStart,
  MAX_BACKUP_BYTES,
  MAX_CHILD_OUTPUT_BYTES,
  validateRestoreListing,
} from '@/lib/database-backup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKUP_TIMEOUT_MS = 2 * 60 * 1000;
const BACKUP_FORMAT = 'postgresql-custom';
let backupInProgress = false;

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
  }

  if (session.role !== 'SUPER_ADMIN') {
    await writeAdminSecurityAudit({
      adminUserId: session.adminId,
      action: 'ADMIN_ACCESS_DENIED',
      pathname: '/admin/api/database-backup',
      method: 'GET',
      permission: 'DATABASE_BACKUP',
      reason: 'permission_denied',
    });
    return NextResponse.json({ error: 'Yalnızca Süper Yöneticiler veritabanı yedeği alabilir.' }, { status: 403 });
  }

  // This deliberately contains no database version, connection information, or
  // customer data. The protected UI reads it before downloading so it can
  // produce a checksum manifest for the exact file the administrator saves.
  if (request.nextUrl.searchParams.get('metadata') === '1') {
    return NextResponse.json({
      format: BACKUP_FORMAT,
      schemaVersion: DATABASE_BACKUP_SCHEMA_VERSION,
      extension: '.dump',
      checksumAlgorithm: DATABASE_BACKUP_CHECKSUM_ALGORITHM,
      verification: 'pg_restore --list',
      restoreGuide: '/docs/DATABASE_BACKUP_RESTORE.md',
    }, {
      headers: { 'Cache-Control': 'no-store, private' },
    });
  }

  if (!process.env.DATABASE_URL) {
    await writeAdminSecurityAudit({
      adminUserId: session.adminId,
      action: 'ADMIN_OPERATION_FAILED',
      pathname: '/admin/api/database-backup',
      method: 'GET',
      permission: 'DATABASE_BACKUP',
      reason: 'database_backup_unavailable',
    });
    return NextResponse.json({ error: 'Yedekleme şu anda kullanılamıyor.' }, { status: 503 });
  }

  if (backupInProgress) {
    return NextResponse.json({ error: 'Başka bir yedekleme işlemi sürüyor. Lütfen tamamlanmasını bekleyin.' }, { status: 429 });
  }

  backupInProgress = true;
  let child: ReturnType<typeof spawn> | null = null;
  try {
    child = spawn('pg_dump', [
      `--dbname=${process.env.DATABASE_URL}`,
      '--format=custom',
      '--no-owner',
      '--no-acl',
      '--compress=9',
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    await waitForDatabaseDumpStart(child);

    const timeout = setTimeout(() => {
      stopDatabaseDump(child!);
      void writeAdminSecurityAudit({
        adminUserId: session.adminId,
        action: 'ADMIN_OPERATION_FAILED',
        pathname: '/admin/api/database-backup',
        method: 'GET',
        permission: 'DATABASE_BACKUP',
        reason: 'database_backup_timed_out',
      });
    }, BACKUP_TIMEOUT_MS);
    timeout.unref();

    const removeAbortListener = stopDatabaseDumpOnAbort(request.signal, child);

    child.once('close', (exitCode) => {
      clearTimeout(timeout);
      removeAbortListener();
      backupInProgress = false;
      void writeAdminSecurityAudit({
        adminUserId: session.adminId,
        action: exitCode === 0 ? 'ADMIN_MUTATION_AUTHORIZED' : 'ADMIN_OPERATION_FAILED',
        pathname: '/admin/api/database-backup',
        method: 'GET',
        permission: 'DATABASE_BACKUP',
        ...(exitCode === 0 ? {} : { reason: 'database_backup_failed' as const }),
      });
    });

    const output = getDatabaseDumpOutput(child);

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return new NextResponse(Readable.toWeb(output) as ReadableStream, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="istanbul-vip-transfer-${stamp}.dump"`,
        'Cache-Control': 'no-store, private',
        'X-Content-Type-Options': 'nosniff',
        // The checksum is calculated over the downloaded bytes by the
        // authenticated admin UI, then saved beside the archive as a manifest.
        // It is not placed in logs or the application database.
        'X-Backup-Format': BACKUP_FORMAT,
        'X-Backup-Checksum-Algorithm': 'SHA-256',
        'X-Backup-Generated-At': new Date().toISOString(),
      },
    });
  } catch {
    backupInProgress = false;
    if (child) stopDatabaseDump(child);
    await writeAdminSecurityAudit({
      adminUserId: session.adminId,
      action: 'ADMIN_OPERATION_FAILED',
      pathname: '/admin/api/database-backup',
      method: 'GET',
      permission: 'DATABASE_BACKUP',
      reason: 'database_backup_failed',
    });
    return NextResponse.json({ error: 'Yedek başlatılamadı. Lütfen daha sonra tekrar deneyin.' }, { status: 500 });
  }
}

function runRestoreProcess(args: string[], timeoutMs = 5 * 60 * 1000) {
  return new Promise<{ code: number; output: string }>((resolve, reject) => {
    const child = spawn('pg_restore', args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let output = '';
      const append = (chunk: Buffer) => {
        if (output.length < MAX_CHILD_OUTPUT_BYTES) {
          output += chunk.toString('utf8').slice(0, MAX_CHILD_OUTPUT_BYTES - output.length);
        }
      };
      child.stdout?.on('data', append);
      child.stderr?.on('data', append);
    const timer = setTimeout(() => {
      stopDatabaseDump(child);
      reject(new Error('database_restore_timeout'));
    }, timeoutMs);
    child.once('error', () => {
      clearTimeout(timer);
      reject(new Error('database_restore_spawn_failed'));
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      // Never return PostgreSQL output: it may contain hostnames or SQL values.
      resolve({ code: code ?? 1, output });
    });
  });
}

/**
 * POST /admin/api/database-backup
 *
 * The web endpoint is deliberately verification-only. Live restores are an
 * offline operator action using scripts/restore-database.ts and a separate
 * RESTORE_TARGET_DATABASE_URL.
 */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
  }
  if (session.role !== 'SUPER_ADMIN') {
    await writeAdminSecurityAudit({
      adminUserId: session.adminId, action: 'ADMIN_ACCESS_DENIED',
      pathname: '/admin/api/database-backup', method: 'POST',
      permission: 'DATABASE_BACKUP', reason: 'permission_denied',
    });
    return NextResponse.json({ error: 'Yalnızca Süper Yöneticiler geri yükleme yapabilir.' }, { status: 403 });
  }
  let directory: string | undefined;
  try {
    const form = await request.formData();
    const uploaded = form.get('file');
    const manifestText = form.get('manifest');
    if (!(uploaded instanceof File) || uploaded.size === 0 || uploaded.size > MAX_BACKUP_BYTES) {
      return NextResponse.json({ error: 'Geçerli bir yedek dosyası yükleyin.' }, { status: 400 });
    }
    if (typeof manifestText !== 'string') {
      return NextResponse.json({ error: 'SHA-256 manifesti gerekli.' }, { status: 400 });
    }
    let manifest: unknown;
    try { manifest = JSON.parse(manifestText); } catch {
      return NextResponse.json({ error: 'Manifest biçimi geçersiz.' }, { status: 400 });
    }
    const bytes = new Uint8Array(await uploaded.arrayBuffer());
    const { validateBackupManifest } = await import('@/lib/database-backup');
    validateBackupManifest(manifest, bytes);
    directory = await mkdtemp(join(tmpdir(), 'ivt-db-restore-'));
    const archivePath = join(directory, 'backup.dump');
    await writeFile(archivePath, bytes, { mode: 0o600 });
    const inspection = await runRestoreProcess(['--list', archivePath]);
    if (inspection.code !== 0) {
      return NextResponse.json({ error: 'Yedek PostgreSQL tarafından doğrulanamadı.' }, { status: 400 });
    }
    const listing = validateRestoreListing(inspection.output);
    await writeAdminSecurityAudit({
      adminUserId: session.adminId, action: 'ADMIN_MUTATION_AUTHORIZED',
      pathname: '/admin/api/database-backup', method: 'POST',
      permission: 'DATABASE_BACKUP',
    });
    return NextResponse.json({
      dryRun: true, valid: true, tables: listing.tables,
      message: 'Yedek doğrulandı; veritabanında değişiklik yapılmadı. Canlı geri yükleme yalnızca offline bakım işlemi olarak çalıştırılabilir.',
    });
  } catch (error) {
    const reason = error instanceof Error && /^backup_/.test(error.message)
      ? error.message : 'database_backup_failed';
    await writeAdminSecurityAudit({
      adminUserId: session.adminId, action: 'ADMIN_OPERATION_FAILED',
      pathname: '/admin/api/database-backup', method: 'POST',
      permission: 'DATABASE_BACKUP', reason: 'database_backup_failed',
    });
    const status = reason.startsWith('backup_') ? 400 : 500;
    return NextResponse.json({ error: status === 400 ? 'Yedek doğrulaması başarısız.' : 'Geri yükleme başarısız.' }, { status });
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}
