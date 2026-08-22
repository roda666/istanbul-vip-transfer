import { describe, expect, it } from 'vitest';
import {
  getAdminApiPermission,
  getAdminPagePermission,
  hasAdminPermission,
} from '@/lib/auth/authorization';

describe('database backup authorization', () => {
  it('reserves the backup capability for SUPER_ADMIN', () => {
    expect(hasAdminPermission('SUPER_ADMIN', 'DATABASE_BACKUP')).toBe(true);
    expect(hasAdminPermission('ADMIN', 'DATABASE_BACKUP')).toBe(false);
    expect(hasAdminPermission('EDITOR', 'DATABASE_BACKUP')).toBe(false);
  });

  it('maps the download endpoint and admin page to the backup capability', () => {
    expect(getAdminApiPermission('/admin/api/database-backup', 'GET')).toBe('DATABASE_BACKUP');
    expect(getAdminPagePermission('/admin/veritabani-yedegi')).toBe('DATABASE_BACKUP');
  });
});