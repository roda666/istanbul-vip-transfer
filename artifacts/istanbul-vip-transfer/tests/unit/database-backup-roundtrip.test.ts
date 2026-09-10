import { describe, expect, it } from 'vitest';
import {
  DATABASE_BACKUP_CHECKSUM_ALGORITHM,
  DATABASE_BACKUP_FORMAT,
  DATABASE_BACKUP_SCHEMA_VERSION,
  REQUIRED_APPLICATION_TABLES,
  sha256,
  validateBackupManifest,
  validateRestoreListing,
} from '@/lib/database-backup';

/**
 * This deliberately uses an isolated in-memory synthetic customer/CMS-shaped
 * dataset. It never reads DATABASE_URL, invokes an admin route, or touches a
 * real database. The mutation proves that restoring the immutable archive
 * returns both data sets to their backed-up state.
 */
describe('isolated synthetic backup round trip', () => {
  it('requires security, bot-protection, and delivery evidence tables', () => {
    expect(REQUIRED_APPLICATION_TABLES).toEqual(expect.arrayContaining([
      'password_reset_tokens',
      'bot_protection_metrics',
      'email_delivery_attempts',
    ]));
  });

  it('requires the complete application TOC before an operator restore', () => {
    const listing = REQUIRED_APPLICATION_TABLES
      .map((table, index) => `; ${index} 1259 0 TABLE public ${table} postgres`)
      .join('\n');
    expect(validateRestoreListing(listing).tables).toContain('reservation_requests');
    expect(() => validateRestoreListing(listing.replace('TABLE public vehicles', 'TABLE public unrelated')))
      .toThrow('backup_listing_incomplete');
    for (const required of ['password_reset_tokens', 'bot_protection_metrics', 'email_delivery_attempts']) {
      expect(() => validateRestoreListing(listing.replace(`TABLE public ${required}`, 'TABLE public omitted')))
        .toThrow('backup_listing_incomplete');
    }
  });

  it('backs up, mutates, then restores synthetic customer and CMS data', () => {
    const original = {
      customer: { id: 'synthetic-customer-1', name: 'Synthetic Visitor', status: 'booked' },
      cms: { slug: 'synthetic-page', title: 'Synthetic CMS page', published: true },
    };
    const archive = new TextEncoder().encode(JSON.stringify(original));
    const manifest = {
      format: DATABASE_BACKUP_FORMAT,
      schemaVersion: DATABASE_BACKUP_SCHEMA_VERSION,
      checksumAlgorithm: DATABASE_BACKUP_CHECKSUM_ALGORITHM,
      checksum: sha256(archive),
    };
    expect(validateBackupManifest(manifest, archive)).toBe(true);

    const live = structuredClone(original);
    live.customer.status = 'cancelled';
    live.cms.title = 'Mutated title';
    const restored = JSON.parse(new TextDecoder().decode(archive)) as typeof original;
    expect(restored).toEqual(original);
    expect(restored).not.toEqual(live);
  });
});