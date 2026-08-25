import 'server-only';

export type HealthStatus = 'ok' | 'warn' | 'error';

export type ServiceHealth = {
  status: HealthStatus;
  label: string;
  detail?: string;
};

type ProbeResult = { ok: true } | { ok: false; reason: 'timeout' | 'failed'; error?: unknown };

const SIDECAR = 'http://127.0.0.1:1106';
const HEALTH_TIMEOUT_MS = 8_000;

function isMissingSchemaError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  return code === '42P01' || code === '42703';
}

async function probe(operation: () => Promise<unknown>, timeoutMs = HEALTH_TIMEOUT_MS): Promise<ProbeResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('HEALTH_CHECK_TIMEOUT')), timeoutMs);
      }),
    ]);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error && error.message === 'HEALTH_CHECK_TIMEOUT' ? 'timeout' : 'failed',
      error,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function probeDatabase(
  operation: () => Promise<unknown>,
  timeoutMs = HEALTH_TIMEOUT_MS,
): Promise<ServiceHealth> {
  const result = await probe(operation, timeoutMs);
  if (result.ok) return { status: 'ok', label: 'Veritabanı sorgu kabul ediyor' };
  return result.reason === 'timeout'
    ? { status: 'error', label: 'Veritabanı zaman aşımına uğradı — tekrar deneyin' }
    : { status: 'error', label: 'Veritabanına erişilemiyor' };
}

type SqlExecutor = (query: unknown) => Promise<unknown>;
type SqlRaw = (query: string) => unknown;

const STUDIO_RELATIONS = [
  'studio_projects',
  'studio_project_translations',
  'studio_images',
  'studio_research',
  'studio_distribution',
  'studio_audit',
  'studio_schedules',
  'ai_draft_cadence_settings',
  'ai_draft_cadence_runs',
] as const;

export type StudioMigrationHealth = ServiceHealth & {
  missing: string[];
};

/**
 * Probes every table read by the Studio control screen and cadence flow.
 * Queries use a fixed allowlist, never an identifier supplied by a request.
 */
export async function probeStudioMigrations(
  execute: SqlExecutor,
  raw: SqlRaw,
): Promise<StudioMigrationHealth> {
  const checks = [
    ...STUDIO_RELATIONS.map((relation) => ({
      name: relation,
      query: `SELECT 1 FROM ${relation} LIMIT 0`,
    })),
    {
      name: 'ai_draft_cadence_settings.config_version',
      query: 'SELECT config_version FROM ai_draft_cadence_settings LIMIT 0',
    },
  ];

  const results = await Promise.all(checks.map(async (check) => ({
    name: check.name,
    result: await probe(() => execute(raw(check.query))),
  })));

  const missing = results
    .filter(({ result }) => !result.ok && isMissingSchemaError(result.error))
    .map(({ name }) => name);
  const unavailable = results.some(({ result }) => !result.ok && !isMissingSchemaError(result.error));

  if (missing.length > 0) {
    return {
      status: 'error',
      label: `Eksik Studio şema bağımlılığı: ${missing.join(', ')}`,
      detail: 'Migration uygulanana kadar taslak sıklığı kullanılamaz.',
      missing,
    };
  }
  if (unavailable) {
    return {
      status: 'error',
      label: 'Studio şema bağımlılıkları doğrulanamadı — tekrar deneyin',
      missing: [],
    };
  }
  return {
    status: 'ok',
    label: 'Studio ve taslak sıklığı şeması hazır',
    missing: [],
  };
}

function parsePrivateObjectDir(value: string) {
  const cleaned = value.trim().replace(/^gs:\/\//, '');
  if (cleaned.startsWith('/')) {
    return {
      bucketName: process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID?.trim() ?? '',
      prefix: cleaned.replace(/^\/+/, ''),
    };
  }
  const slash = cleaned.indexOf('/');
  return {
    bucketName: slash === -1 ? cleaned : cleaned.slice(0, slash),
    prefix: slash === -1 ? '' : cleaned.slice(slash + 1),
  };
}

type FetchLike = typeof fetch;

/**
 * Signing a disposable PUT URL verifies the configured bucket and sidecar
 * without writing an object or exposing any signed URL to an admin response.
 */
export async function probeObjectStorage(
  privateObjectDir: string | undefined,
  fetcher: FetchLike = fetch,
): Promise<ServiceHealth & { configured: boolean }> {
  if (!privateObjectDir?.trim()) {
    return {
      status: 'warn',
      configured: false,
      label: 'Nesne depolama yapılandırılmamış — AI görselleri kalıcı olmayabilir',
    };
  }

  const { bucketName, prefix } = parsePrivateObjectDir(privateObjectDir);
  if (!bucketName) {
    return {
      status: 'error',
      configured: true,
      label: 'Nesne depolama yapılandırması geçersiz',
    };
  }

  const result = await probe(async () => {
    const response = await fetcher(`${SIDECAR}/object-storage/signed-object-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bucket_name: bucketName,
        object_name: [prefix, 'healthcheck', 'studio-signing-check.webp'].filter(Boolean).join('/'),
        method: 'PUT',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      }),
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error('STORAGE_SIGNING_FAILED');
    const body = await response.json() as { signed_url?: unknown };
    if (typeof body.signed_url !== 'string' || !body.signed_url) throw new Error('STORAGE_SIGNING_FAILED');
  });

  if (result.ok) {
    return { status: 'ok', configured: true, label: 'Nesne depolama imzalı yükleme URL’si üretebiliyor' };
  }
  return {
    status: 'error',
    configured: true,
    label: result.reason === 'timeout'
      ? 'Nesne depolama zaman aşımına uğradı — tekrar deneyin'
      : 'Nesne depolama imzalı yükleme URL’si üretemiyor',
  };
}

function schedulerFlag(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return 'missing';
  if (normalized === 'true') return 'enabled';
  if (normalized === 'false') return 'disabled';
  return 'invalid';
}

export function probeStudioScheduler(input: {
  enabledFlag: string | undefined;
  cronSecretConfigured: boolean;
  migrations: StudioMigrationHealth;
}): ServiceHealth & { ready: boolean } {
  const flag = schedulerFlag(input.enabledFlag);
  if (flag === 'invalid') {
    return {
      status: 'error',
      ready: false,
      label: 'STUDIO_SCHEDULER_ENABLED yalnızca true veya false olabilir',
    };
  }
  if (!input.cronSecretConfigured) {
    return {
      status: 'error',
      ready: false,
      label: 'Zamanlayıcı kimlik doğrulaması yapılandırılmamış',
    };
  }
  if (input.migrations.status !== 'ok') {
    return {
      status: 'error',
      ready: false,
      label: 'Zamanlayıcı için Studio şema bağımlılıkları hazır değil',
    };
  }
  if (flag === 'disabled') {
    return {
      status: 'warn',
      ready: false,
      label: 'Zamanlayıcı devre dışı — yalnızca manuel taslak oluşturma kullanılabilir',
    };
  }
  if (flag === 'missing') {
    return {
      status: 'warn',
      ready: true,
      label: 'Zamanlayıcı eski uyumluluk modunda hazır — STUDIO_SCHEDULER_ENABLED açıkça ayarlanmamış',
    };
  }
  return {
    status: 'ok',
    ready: true,
    label: 'Zamanlayıcı tetiklenmeye ve taslak sıklığını çalıştırmaya hazır',
  };
}