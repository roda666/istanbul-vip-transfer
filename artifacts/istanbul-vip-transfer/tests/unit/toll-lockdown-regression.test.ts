import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const migration = readFileSync(resolve(root, 'drizzle/migrations/0095_toll_point_verification_lockdown.sql'), 'utf8');
const writeGuardMigration = readFileSync(resolve(root, 'drizzle/migrations/0097_toll_lock_write_guards.sql'), 'utf8');
const management = readFileSync(resolve(root, 'lib/toll-management.ts'), 'utf8');
const pricing = readFileSync(resolve(root, 'lib/admin-pricing-service.ts'), 'utf8');
const pointApi = readFileSync(resolve(root, 'app/admin/api/pricing/tolls/[id]/route.ts'), 'utf8');
const tariffApi = readFileSync(resolve(root, 'app/admin/api/pricing/tolls/tariffs/route.ts'), 'utf8');
const tariffPatchApi = readFileSync(resolve(root, 'app/admin/api/pricing/tolls/tariffs/[id]/route.ts'), 'utf8');
const syncApi = readFileSync(resolve(root, 'app/admin/api/pricing/tolls/sync/route.ts'), 'utf8');
const importPreviewApi = readFileSync(resolve(root, 'app/admin/api/pricing/tolls/import/preview/route.ts'), 'utf8');
const importConfirmApi = readFileSync(resolve(root, 'app/admin/api/pricing/tolls/import/confirm/route.ts'), 'utf8');
const alternativeApi = readFileSync(resolve(root, 'app/admin/api/pricing/tolls/alternatives/route.ts'), 'utf8');
const alternativePatchApi = readFileSync(resolve(root, 'app/admin/api/pricing/tolls/alternatives/[id]/route.ts'), 'utf8');
const ui = readFileSync(resolve(root, 'app/admin/(protected)/yol-gecis-ucretleri/_TollManagementClient.tsx'), 'utf8');

describe('toll verification lockdown regression', () => {
  it('contains only the three authorized lockdown IDs and preserves protected IDs', () => {
    for (const id of [
      '23fa5f1d-b43f-43ab-9984-c2684cf8055d',
      '1058e3a6-07a8-4844-bc1a-6e9d31314597',
      '402dfb8e-176f-4b18-8cfe-020557765768',
    ]) expect(migration).toContain(id);
    expect(migration).not.toContain('3a812620-710a-4071-8671-99ad75274e40');
    expect(migration).not.toContain('cc338726-d24f-4ae5-971d-23b82a89ed57');
    expect(migration).toContain('verification_locked');
    expect(migration).toContain('verification_lock_reason');
  });

  it('hard-excludes locked points in both resolver paths', () => {
    expect(management).toContain('eq(tollPoints.verificationLocked, false)');
    expect(management).toContain('safeAlternatives');
    expect(pricing).toContain('eq(tollPoints.verificationLocked, false)');
  });

  it('rejects normal API edits before attempting a locked-point update', () => {
    expect(pointApi).toContain('existing?.verificationLocked');
    expect(pointApi).toContain('status: 409');
    expect(migration).toContain('Active tariff is forbidden for a locked toll point');
    expect(writeGuardMigration).toContain('No tariff (including inactive drafts)');
    for (const source of [tariffApi, tariffPatchApi, syncApi, importPreviewApi, importConfirmApi, alternativeApi, alternativePatchApi]) {
      expect(source).toContain('status: 409');
    }
  });

  it('keeps direct old selections unavailable and controls every locked-point action', () => {
    expect(management).toContain('point.verificationLocked');
    expect(ui).toContain('disabled={point.verificationLocked}');
    expect(ui).toContain('Kilitli nokta: resmî kaynak ve yetkili inceleme gerekir');
    expect(ui).toContain('Kilitli nokta: senkronizasyon devre dışı');
  });
});