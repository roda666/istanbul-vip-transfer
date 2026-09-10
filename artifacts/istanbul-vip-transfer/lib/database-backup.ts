import 'server-only';
import type { ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';

type DumpProcess = Pick<ChildProcess, 'exitCode' | 'killed' | 'kill' | 'once' | 'removeListener' | 'stdout'>;
type Schedule = (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;

/** The on-disk contract for an administrator supplied backup manifest. */
export const DATABASE_BACKUP_SCHEMA_VERSION = 1;
export const DATABASE_BACKUP_FORMAT = 'postgresql-custom';
export const DATABASE_BACKUP_CHECKSUM_ALGORITHM = 'SHA-256';
/** Conservative upload limit shared by the browser endpoint and operators. */
export const MAX_BACKUP_BYTES = 256 * 1024 * 1024;
/** Tables which make an archive an application backup rather than a partial dump. */
export const REQUIRED_APPLICATION_TABLES = [
  'admin_users', 'ai_content_suggestions', 'ai_draft_cadence_runs', 'ai_draft_cadence_settings',
  'audit_logs', 'blog_health_alerts', 'blog_health_runs', 'blog_revisions', 'bot_protection_metrics',
  'chatbot_messages', 'chatbot_sessions', 'chatbot_settings', 'chatbot_knowledge',
  'competitor_sites', 'content', 'content_translations', 'custom_reservation_fields',
  'email_encryption_keys', 'email_settings', 'email_delivery_attempts', 'exchange_rate_history', 'exchange_rate_settings',
  'faqs', 'fixed_price_overrides', 'flight_meet_greet_settings', 'google_ads_connections',
  'google_reviews', 'gsc_connections', 'health_check_leases', 'integration_secrets',
  'integration_secrets_encryption_keys', 'languages', 'locations', 'navigation_items',
  'newsletter_consent_events', 'newsletter_subscribers', 'newsletter_tokens', 'optional_services',
  'password_reset_tokens', 'price_calculator_settings', 'price_quote_snapshots', 'research_sources', 'reservation_requests',
  'reservation_submission_failures', 'route_price_rules', 'route_toll_alternative_items',
  'route_toll_alternatives', 'service_categories', 'service_health_alerts', 'service_health_runs',
  'service_types', 'site_settings', 'social_platforms', 'studio_audit', 'studio_distribution',
  'studio_images', 'studio_projects', 'studio_project_translations', 'studio_research',
  'studio_schedules', 'toll_points', 'toll_pricing_settings', 'toll_tariffs', 'topic_clusters',
  'transfer_routes', 'transfer_route_translations', 'translation_jobs', 'translation_job_tasks',
  'turnstile_encryption_keys', 'turnstile_settings', 'vehicle_feature_defaults',
  'vehicle_pricing_profiles', 'vehicles', 'vehicle_toll_point_classes',
] as const;
/** pg_restore classes accepted from an application-only custom archive. */
export const SAFE_RESTORE_DESCRIPTOR_CLASSES = [
  'SCHEMA', 'COMMENT', 'TYPE', 'TABLE', 'SEQUENCE', 'SEQUENCE OWNED BY',
  'DEFAULT', 'TABLE DATA', 'SEQUENCE SET', 'CONSTRAINT', 'FK CONSTRAINT',
  'INDEX', 'TRIGGER',
] as const;

export const MAX_CHILD_OUTPUT_BYTES = 64 * 1024;

export type BackupManifest = {
  format: typeof DATABASE_BACKUP_FORMAT;
  schemaVersion: number;
  checksumAlgorithm: typeof DATABASE_BACKUP_CHECKSUM_ALGORITHM;
  checksum: string;
};

export function sha256(bytes: Uint8Array | ArrayBuffer) {
  return createHash('sha256').update(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes).digest('hex');
}

/**
 * Validate the small, non-sensitive manifest before starting pg_restore.
 * Keeping this independent of PostgreSQL makes restore verification testable
 * without ever connecting to a customer database.
 */
export function validateBackupManifest(manifest: unknown, archive: Uint8Array | ArrayBuffer) {
  if (!manifest || typeof manifest !== 'object') throw new Error('backup_manifest_invalid');
  const value = manifest as Partial<BackupManifest>;
  if (value.format !== DATABASE_BACKUP_FORMAT) throw new Error('backup_format_invalid');
  if (value.schemaVersion !== DATABASE_BACKUP_SCHEMA_VERSION) throw new Error('backup_schema_version_invalid');
  if (value.checksumAlgorithm !== DATABASE_BACKUP_CHECKSUM_ALGORITHM) throw new Error('backup_checksum_algorithm_invalid');
  if (!/^[a-f0-9]{64}$/i.test(value.checksum ?? '')) throw new Error('backup_checksum_invalid');
  if (sha256(archive) !== value.checksum!.toLowerCase()) throw new Error('backup_checksum_mismatch');
  return true;
}

/** Validate pg_restore's non-sensitive TOC listing before any restore attempt. */
export function validateRestoreListing(listing: string) {
  if (!listing || listing.length > MAX_CHILD_OUTPUT_BYTES) throw new Error('backup_listing_invalid');
  const tables = new Set<string>();
  for (const line of listing.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // Read the descriptor only from the structural prefix. A function name
    // or schema may contain words such as TABLE or INDEX.
    const entry = line.match(/^(?:\d+;\s+\d+\s+\d+\s+(.+)|;\s+\d+\s+\d+\s+\d+\s+(.+))$/);
    if (!entry) throw new Error('backup_listing_invalid');
    const body = entry[1] ?? entry[2];
    const descriptorClass = [...SAFE_RESTORE_DESCRIPTOR_CLASSES]
      .sort((a, b) => b.length - a.length)
      .find(candidate => body === candidate || body.startsWith(`${candidate} `));
    if (!descriptorClass) throw new Error('backup_listing_unapproved_object');
    // pg_restore --list uses: ...; TABLE schema table owner
    const match = descriptorClass === 'TABLE'
      ? body.match(/^TABLE\s+(?:"[^"]+"|\S+)\s+(?:"([^"]+)"|([a-zA-Z_][\w$]*))(?:\s|$)/)
      : null;
    const table = match?.[1] ?? match?.[2];
    if (table) tables.add(table);
  }
  const required = new Set<string>(REQUIRED_APPLICATION_TABLES);
  const missing = REQUIRED_APPLICATION_TABLES.filter((table) => !tables.has(table));
  const unexpected = [...tables].filter((table) => !required.has(table));
  if (missing.length) throw new Error('backup_listing_incomplete');
  if (unexpected.length) throw new Error('backup_listing_unexpected_table');
  return { tables: [...tables] };
}

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