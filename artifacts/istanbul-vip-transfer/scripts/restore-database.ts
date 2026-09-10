/**
 * Offline restore tool. This file is intentionally not imported by Next.js.
 * Connection strings are supplied through environment variables, never argv.
 */
import { readFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MAX_BACKUP_BYTES, validateBackupManifest, validateRestoreListing } from '../lib/database-backup.js';

const exec = promisify(execFile);
const ACK = 'I_UNDERSTAND_MAINTENANCE_RESTORE';
const source = process.env.DATABASE_URL;
const target = process.env.RESTORE_TARGET_DATABASE_URL;
const archivePath = process.argv[2];
const manifestPath = process.argv[3];

if (!source || !target) throw new Error('DATABASE_URL and RESTORE_TARGET_DATABASE_URL are required');
const sourceUrl: string = source;
const targetUrl: string = target;
if (process.env.RESTORE_MAINTENANCE_ACK !== ACK) {
  throw new Error(`Set RESTORE_MAINTENANCE_ACK=${ACK} after approved maintenance planning`);
}
if (!archivePath || !manifestPath) throw new Error('Usage: tsx scripts/restore-database.ts ARCHIVE MANIFEST');

function identity(value: string) {
  const url = new URL(value);
  return `${url.protocol}//${url.hostname}:${url.port || '5432'}${url.pathname}`;
}
if (identity(sourceUrl) === identity(targetUrl)) throw new Error('Restore target must not equal DATABASE_URL');
if (/(prod|production|deploy|live|customer)/i.test(identity(targetUrl)) &&
    process.env.RESTORE_MAINTENANCE_ACK !== ACK) {
  throw new Error('Production-like targets require explicit maintenance acknowledgement');
}

async function main() {
  const archiveStats = await stat(archivePath);
  if (archiveStats.size > MAX_BACKUP_BYTES) throw new Error('backup_archive_too_large');
  const archive = await readFile(archivePath);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  validateBackupManifest(manifest, archive);
  const listing = await exec('pg_restore', ['--format=custom', '--list', archivePath]);
  validateRestoreListing(listing.stdout);

  // Refuse populated targets. This query is deliberately limited to ordinary
  // tables and keeps the restore from overwriting an unknown database.
  const targetCheck = await exec('psql', ['--dbname', targetUrl, '--tuples-only', '--no-align',
    '--command', "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname NOT IN ('pg_catalog','information_schema');"]);
  if (Number.parseInt(targetCheck.stdout.trim(), 10) !== 0) {
    throw new Error('Restore target is not empty or isolated');
  }
  await exec('pg_restore', [
    '--dbname', targetUrl, '--format=custom', '--single-transaction',
    '--exit-on-error', '--no-owner', '--no-acl', archivePath,
  ]);
  console.log('Restore completed into the approved empty target.');
}

main().catch((error) => {
  // Child-process errors can echo argv (including a connection string).
  const message = error instanceof Error ? error.message : '';
  const safe = /^(DATABASE_URL|RESTORE_|Usage:|Set RESTORE_|Production-like|Restore target|Restore completed|Restore failed|backup_)/.test(message)
    ? message : 'Restore failed; inspect the approved operator change record.';
  console.error(safe);
  process.exitCode = 1;
});