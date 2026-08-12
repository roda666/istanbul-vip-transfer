/**
 * Drizzle ORM client — singleton postgres.js connection (lazy initialisation).
 *
 * The client is created on first access rather than at module load time so that
 * `next build` does not crash when DATABASE_URL is absent in CI. All routes
 * that touch the DB declare `export const dynamic = 'force-dynamic'`, which
 * prevents Next.js from executing them during the build step.
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

export type DB = ReturnType<typeof drizzle<typeof schema>>;

let _db: DB | null = null;

function createDb(): DB {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is not set.\n' +
        'Please add DATABASE_URL to Replit Secrets and restart the server.\n' +
        'See ADMIN_SETUP.md for setup instructions.',
    );
  }

  const client = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
  });

  return drizzle(client, { schema });
}

export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    if (!_db) _db = createDb();
    return (_db as unknown as Record<string | symbol, unknown>)[prop];
  },
});
