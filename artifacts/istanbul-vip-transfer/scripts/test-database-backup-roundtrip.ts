/**
 * Real, isolated backup/restore verification.
 *
 * This script is intentionally opt-in and development-only. It creates one
 * unpredictable schema, uses only tables in that schema, and removes it in a
 * finally block. It must never be pointed at a production connection.
 */
import postgres from 'postgres';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
if (process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1') {
  throw new Error('Refusing backup round-trip in a production deployment');
}
const parsed = new URL(url);
const identity = `${parsed.hostname}/${parsed.pathname}`;
if (/(prod|production|live|customer)/i.test(identity)) {
  throw new Error('DATABASE_URL looks production-like; refusing to continue');
}

const suffix = randomBytes(12).toString('hex');
const schema = `ivt_backup_test_${suffix}`;
const ident = /^[a-z_][a-z0-9_]*$/.test(schema) ? schema : (() => { throw new Error('invalid generated schema'); })();
const sql = postgres(url, { max: 1, connect_timeout: 10 });
let directory: string | undefined;

async function main() {
  directory = await mkdtemp(join(tmpdir(), 'ivt-backup-e2e-'));
  const archive = join(directory, 'synthetic.dump');
  await sql.unsafe(`CREATE SCHEMA "${ident}"`);
  await sql.unsafe(`CREATE TABLE "${ident}".synthetic_customers (id text PRIMARY KEY, name text NOT NULL, status text NOT NULL)`);
  await sql.unsafe(`CREATE TABLE "${ident}".synthetic_cms_pages (slug text PRIMARY KEY, title text NOT NULL, published boolean NOT NULL)`);
  await sql.unsafe(`INSERT INTO "${ident}".synthetic_customers VALUES ('customer-1', 'Synthetic Visitor', 'booked')`);
  await sql.unsafe(`INSERT INTO "${ident}".synthetic_cms_pages VALUES ('synthetic-page', 'Synthetic CMS', true)`);

  await exec('pg_dump', [`--dbname=${url}`, '--format=custom', `--schema=${ident}`, `--file=${archive}`]);
  const bytes = await (await import('node:fs/promises')).readFile(archive);
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const list = await exec('pg_restore', ['--list', archive]);
  if (!list.stdout.includes('synthetic_customers') || !list.stdout.includes('synthetic_cms_pages')) {
    throw new Error('synthetic tables missing from archive');
  }
  if (createHash('sha256').update(bytes).digest('hex') !== checksum) throw new Error('checksum verification failed');

  await sql.unsafe(`UPDATE "${ident}".synthetic_customers SET status = 'cancelled'`);
  await sql.unsafe(`DELETE FROM "${ident}".synthetic_cms_pages`);
  await sql.unsafe(`DROP SCHEMA "${ident}" CASCADE`);
  await exec('pg_restore', [`--dbname=${url}`, '--format=custom', '--single-transaction', '--no-owner', '--no-acl', archive]);
  const customers = await sql.unsafe(`SELECT id, name, status FROM "${ident}".synthetic_customers`);
  const pages = await sql.unsafe(`SELECT slug, title, published FROM "${ident}".synthetic_cms_pages`);
  if (customers.length !== 1 || customers[0].status !== 'booked' || pages.length !== 1 || pages[0].title !== 'Synthetic CMS') {
    throw new Error('restored synthetic rows do not match the backup');
  }
  console.log(`PASS isolated pg_dump/pg_restore round-trip schema=${ident} sha256=${checksum}`);
}

try {
  await main();
} finally {
  await sql.unsafe(`DROP SCHEMA IF EXISTS "${ident}" CASCADE`).catch(() => undefined);
  await sql.end({ timeout: 5 }).catch(() => undefined);
  if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
}