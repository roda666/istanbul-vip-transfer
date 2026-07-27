/**
 * Drizzle ORM client — singleton postgres.js connection.
 * Only imported in server-side code (Server Components, Route Handlers, Server Actions).
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL environment variable is not set.\n' +
      'Please add DATABASE_URL to Replit Secrets and restart the server.\n' +
      'See ADMIN_SETUP.md for setup instructions.',
  );
}

// postgres.js client — pooled, handles sslmode from the URL automatically
const client = postgres(databaseUrl, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

export type DB = typeof db;
