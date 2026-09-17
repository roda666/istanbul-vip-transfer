// Shared helper for prebuild guard scripts that must query the database.
//
// In real development and production environments DATABASE_URL always points
// at a real, reachable database — these checks (toll/fee safety scan, image
// filename policy, sitemap/noindex conflict, redirect destinations) MUST run
// for real there and MUST keep failing the build on a genuine violation.
// Nothing here changes that.
//
// GitHub Actions' Typecheck/Lint/Build job, however, has no database at all
// (it only builds the Next.js app — none of these scripts' checks are
// exercised at runtime, since the routes they guard are all force-dynamic).
// Without this guard, a missing/unreachable DB made every prebuild script
// crash with an uncaught ECONNREFUSED, permanently red-X'ing the workflow.
//
// The fallback below is intentionally scoped to `process.env.CI` — the
// environment variable GitHub Actions (and most other CI systems) sets
// automatically — so it can only ever trigger there, never in a real dev or
// production run of this project.
import postgres from '../../node_modules/postgres/src/index.js';

function warnAndExit(scriptLabel, reason) {
  console.warn(
    `⚠️  ${scriptLabel}: ${reason} — CI ortamında veritabanı yok, kontrol atlanıyor.\n` +
      `   (Bu kontrol gerçek geliştirme/production ortamında DATABASE_URL mevcut olduğu için her zaman tam olarak çalışır.)`,
  );
  process.exit(0);
}

/**
 * Returns a connected `postgres` client, or — only when `process.env.CI` is
 * set and the database is genuinely unreachable/unset — logs a warning and
 * exits the process with code 0 instead of throwing.
 */
export async function connectOrSkipInCi(scriptLabel) {
  if (!process.env.DATABASE_URL) {
    if (process.env.CI) warnAndExit(scriptLabel, 'DATABASE_URL tanımlı değil');
    throw new Error('DATABASE_URL not set');
  }
  const sql = postgres(process.env.DATABASE_URL, { connect_timeout: 5 });
  try {
    await sql`SELECT 1`;
    return sql;
  } catch (err) {
    await sql.end({ timeout: 1 }).catch(() => {});
    if (process.env.CI) {
      warnAndExit(scriptLabel, `veritabanına bağlanılamadı (${err instanceof Error ? err.message : err})`);
    }
    throw err;
  }
}
