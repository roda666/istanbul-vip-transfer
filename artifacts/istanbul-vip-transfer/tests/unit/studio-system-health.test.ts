import { describe, expect, it } from 'vitest';
import {
  probeDatabase,
  probeObjectStorage,
  probeStudioMigrations,
  probeStudioScheduler,
} from '@/lib/studio/system-health';

const raw = (query: string) => query;

describe('AI Studio system health probes', () => {
  it('reports all required Studio and cadence dependencies as healthy', async () => {
    const migration = await probeStudioMigrations(async () => undefined, raw);
    const storage = await probeObjectStorage(
      'bucket-name/studio',
      (async () => new Response(JSON.stringify({ signed_url: 'https://example.test/upload' }), { status: 200 })) as typeof fetch,
    );
    const scheduler = probeStudioScheduler({
      enabledFlag: 'true',
      cronSecretConfigured: true,
      migrations: migration,
    });

    expect(migration).toMatchObject({ status: 'ok', missing: [] });
    expect(storage).toMatchObject({ status: 'ok', configured: true });
    expect(scheduler).toMatchObject({ status: 'ok', ready: true });
  });

  it('reports missing cadence tables and config_version safely by name', async () => {
    const migration = await probeStudioMigrations(
      async (query) => {
        if (String(query).includes('ai_draft_cadence')) {
          throw { code: String(query).includes('config_version') ? '42703' : '42P01' };
        }
      },
      raw,
    );

    expect(migration.status).toBe('error');
    expect(migration.missing).toEqual(expect.arrayContaining([
      'ai_draft_cadence_settings',
      'ai_draft_cadence_runs',
      'ai_draft_cadence_settings.config_version',
    ]));
    expect(migration.label).not.toMatch(/postgres|password|database_url/i);
  });

  it('returns a retryable error instead of waiting indefinitely for a slow database', async () => {
    const health = await probeDatabase(
      () => new Promise(() => undefined),
      1,
    );

    expect(health).toMatchObject({ status: 'error' });
    expect(health.label).toContain('zaman aşımına');
  });

  it('distinguishes missing and unusable object storage', async () => {
    const missing = await probeObjectStorage(undefined);
    const unavailable = await probeObjectStorage(
      'bucket-name',
      (async () => new Response(null, { status: 503 })) as typeof fetch,
    );

    expect(missing).toMatchObject({ status: 'warn', configured: false });
    expect(unavailable).toMatchObject({ status: 'error', configured: true });
  });

  it('does not mark invalid, unauthenticated, or schema-blocked schedulers as ready', () => {
    const migration = { status: 'error' as const, label: 'Eksik şema', missing: ['ai_draft_cadence_settings'] };

    expect(probeStudioScheduler({ enabledFlag: 'yes', cronSecretConfigured: true, migrations: migration }))
      .toMatchObject({ status: 'error', ready: false });
    expect(probeStudioScheduler({ enabledFlag: 'true', cronSecretConfigured: false, migrations: { ...migration, status: 'ok', missing: [] } }))
      .toMatchObject({ status: 'error', ready: false });
    expect(probeStudioScheduler({ enabledFlag: 'true', cronSecretConfigured: true, migrations: migration }))
      .toMatchObject({ status: 'error', ready: false });
    expect(probeStudioScheduler({
      enabledFlag: 'false',
      cronSecretConfigured: true,
      migrations: { ...migration, status: 'ok', missing: [] },
    }))
      .toMatchObject({ status: 'warn', ready: false });
  });

  it('keeps existing authorized cron schedules working when the optional flag is absent', () => {
    const migrations = { status: 'ok' as const, label: 'Hazır', missing: [] };

    expect(probeStudioScheduler({ enabledFlag: undefined, cronSecretConfigured: true, migrations }))
      .toMatchObject({ status: 'warn', ready: true });
  });
});