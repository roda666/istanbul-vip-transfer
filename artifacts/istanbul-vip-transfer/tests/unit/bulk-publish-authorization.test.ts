import { describe, expect, it } from 'vitest';
import { getAdminApiPermission, hasAdminPermission } from '../../lib/auth/authorization';

describe('bulk translation publish permission inventory', () => {
  it('maps the exact route to CONTENT_PUBLISH before generic translations management', () => {
    expect(getAdminApiPermission('/admin/api/translations/bulk-publish', 'POST')).toBe('CONTENT_PUBLISH');
    expect(getAdminApiPermission('/admin/api/translations', 'POST')).toBe('TRANSLATIONS_MANAGE');
  });

  it('allows publishing roles and denies editor/chat staff', () => {
    expect(hasAdminPermission('ADMIN', 'CONTENT_PUBLISH')).toBe(true);
    expect(hasAdminPermission('SUPER_ADMIN', 'CONTENT_PUBLISH')).toBe(true);
    expect(hasAdminPermission('EDITOR', 'CONTENT_PUBLISH')).toBe(false);
    expect(hasAdminPermission('CHAT_STAFF', 'CONTENT_PUBLISH')).toBe(false);
    expect(hasAdminPermission(undefined, 'CONTENT_PUBLISH')).toBe(false);
  });
});