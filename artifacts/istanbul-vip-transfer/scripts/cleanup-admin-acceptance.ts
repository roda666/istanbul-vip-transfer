import { and, eq, inArray, like, or, sql } from 'drizzle-orm';
import { closeDatabaseConnection, db } from '../db';
import { adminUsers, auditLogs } from '../db/schema';

const TEST_EMAIL_PREFIX = 'playwright-admin-%';

/** Remove only disposable acceptance accounts and their audit records. */
export async function cleanupAdminAcceptanceAccounts() {
  try {
    const users = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(like(adminUsers.email, TEST_EMAIL_PREFIX));
    const ids = users.map(({ id }) => id);

    if (ids.length > 0) {
    const references = await db.execute(sql`
      SELECT
        tc.table_schema,
        tc.table_name,
        kcu.column_name,
        rc.delete_rule,
        cols.is_nullable
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.constraint_schema = kcu.constraint_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.constraint_schema = rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.constraint_schema = tc.constraint_schema
      JOIN information_schema.columns cols
        ON cols.table_schema = tc.table_schema
        AND cols.table_name = tc.table_name
        AND cols.column_name = kcu.column_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_schema = 'public'
        AND ccu.table_name = 'admin_users'
        AND ccu.column_name = 'id'
        AND rc.delete_rule NOT IN ('CASCADE', 'SET NULL')
    `) as unknown as Array<{
      table_schema: string;
      table_name: string;
      column_name: string;
      delete_rule: string;
      is_nullable: 'YES' | 'NO';
    }>;

    for (const reference of references) {
      const schema = sql.identifier(reference.table_schema);
      const table = sql.identifier(reference.table_name);
      const column = sql.identifier(reference.column_name);
      if (reference.is_nullable === 'YES') {
        await db.execute(sql`
          UPDATE ${schema}.${table}
          SET ${column} = NULL
          WHERE ${column} IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
        `);
        continue;
      }

      const result = await db.execute(sql`
        SELECT count(*)::int AS count
        FROM ${schema}.${table}
        WHERE ${column} IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
      `) as unknown as Array<{ count: number }>;
      if ((result[0]?.count ?? 0) > 0) {
        throw new Error(
          `Cannot remove disposable admins: ${reference.table_schema}.${reference.table_name}.${reference.column_name} has required references`,
        );
      }
    }

    await db.delete(auditLogs).where(or(
      inArray(auditLogs.adminUserId, ids),
      and(eq(auditLogs.entityType, 'AdminUser'), inArray(auditLogs.entityId, ids)),
    ));
    await db.delete(adminUsers).where(and(
      like(adminUsers.email, TEST_EMAIL_PREFIX),
      inArray(adminUsers.id, ids),
    ));
    }

    const remaining = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(like(adminUsers.email, TEST_EMAIL_PREFIX));
    if (remaining.length !== 0) {
      throw new Error(`Admin acceptance cleanup left ${remaining.length} disposable account(s)`);
    }
    return ids.length;
  } finally {
    await closeDatabaseConnection();
  }
}

if (process.argv[1]?.endsWith('cleanup-admin-acceptance.ts')) {
  cleanupAdminAcceptanceAccounts()
    .then((count) => {
      console.log(`Cleaned ${count} admin acceptance account(s).`);
    })
    .catch((error) => {
      console.error('Admin acceptance cleanup failed.');
      console.error(error instanceof Error ? error.message : 'Unknown cleanup error');
      process.exitCode = 1;
    });
}