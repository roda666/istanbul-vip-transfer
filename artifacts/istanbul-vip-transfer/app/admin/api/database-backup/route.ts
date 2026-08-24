/**
 * GET /admin/api/database-backup
 *
 * Streams a custom-format PostgreSQL dump directly to a SUPER_ADMIN browser.
 * The archive is intentionally never written to the workspace, object storage,
 * logs, or the application database. Restoration remains an offline operation.
 */
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { writeAdminSecurityAudit } from '@/lib/auth/audit';
import {
  getDatabaseDumpOutput,
  stopDatabaseDump,
  stopDatabaseDumpOnAbort,
  waitForDatabaseDumpStart,
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
      extension: '.dump',
      checksumAlgorithm: 'SHA-256',
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