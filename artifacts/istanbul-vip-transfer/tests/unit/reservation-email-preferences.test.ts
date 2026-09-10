import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('reservation email preferences', () => {
  it('defines both database switches with false defaults', () => {
    const schema = read('db/schema.ts');
    const migration = read('drizzle/migrations/0081_reservation_email_preferences.sql');
    expect(schema).toMatch(/adminNewReservationNotification: boolean\([^)]*\)\.default\(false\)\.notNull\(\)/);
    expect(schema).toMatch(/customerConfirmationEmail: boolean\([^)]*\)\.default\(false\)\.notNull\(\)/);
    expect(migration).toMatch(/admin_new_reservation_notification.*DEFAULT false/s);
    expect(migration).toMatch(/customer_confirmation_email.*DEFAULT false/s);
  });

  it('keeps notification sends behind their independent switches', () => {
    const route = read('app/data/submit-request/route.ts');
    expect(route).toContain('let emailSettings = { adminNewReservationNotification: false, customerConfirmationEmail: false }');
    expect(route).toContain('emailSettings.customerConfirmationEmail && normalizedEmail');
    expect(route).toContain('emailSettings.adminNewReservationNotification ? await getAdminNotifyEmails() : []');
  });
});