import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const migration = readFileSync(resolve(root, 'drizzle/migrations/0099_remove_toll_verification_lockdown.sql'), 'utf8');
const management = readFileSync(resolve(root, 'lib/toll-management.ts'), 'utf8');
const pricing = readFileSync(resolve(root, 'lib/admin-pricing-service.ts'), 'utf8');
const ui = readFileSync(resolve(root, 'app/admin/(protected)/yol-gecis-ucretleri/_TollManagementClient.tsx'), 'utf8');

describe('owner-approved toll verification unlock regression', () => {
  it('clears only the exact three lock flags and never writes active or financial fields', () => {
    for (const id of [
      '23fa5f1d-b43f-43ab-9984-c2684cf8055d',
      '1058e3a6-07a8-4844-bc1a-6e9d31314597',
      '402dfb8e-176f-4b18-8cfe-020557765768',
    ]) expect(migration).toContain(id);
    expect(migration).toContain('verification_locked = false');
    expect(migration).toContain('verification_lock_reason = NULL');
    expect(migration).toContain('verification_locked_at = NULL');
    expect(migration).toContain('verification_locked_by = NULL');
    expect(migration).not.toMatch(/\bactive\s*=/);
    expect(migration).not.toMatch(/\bamount_kurus\s*=/);
    expect(migration).toContain('DROP FUNCTION IF EXISTS reject_locked_toll_point_use');
    expect(migration).toContain('DROP FUNCTION IF EXISTS reject_locked_toll_point_delete');
  });

  it('does not filter unverified points from admin or resolver paths', () => {
    expect(management).not.toContain('verificationLocked');
    expect(pricing).not.toContain('verificationLocked');
  });

  it('keeps admin actions available and retains a non-blocking unverified warning', () => {
    expect(ui).not.toContain('disabled={point.verificationLocked}');
    expect(ui).toContain('Doğrulanmamış ilave ücret');
    expect(ui).toContain('Admin bu veriyi yönetebilir');
    expect(ui).toContain('müşteriye gösterilmez');
  });
});