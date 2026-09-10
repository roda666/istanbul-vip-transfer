import { describe, expect, it } from 'vitest';
import { getAdminRedirectPath } from '@/lib/admin/redirect';

describe('admin entry redirect', () => {
  it('sends chat staff to the chat panel', () => {
    expect(getAdminRedirectPath('CHAT_STAFF')).toBe('/admin/sohbet');
  });

  it('sends every other admin role to pricing calculation', () => {
    expect(getAdminRedirectPath('ADMIN')).toBe('/admin/fiyat-kurallari');
    expect(getAdminRedirectPath('SUPER_ADMIN')).toBe('/admin/fiyat-kurallari');
    expect(getAdminRedirectPath('')).toBe('/admin/fiyat-kurallari');
  });
});