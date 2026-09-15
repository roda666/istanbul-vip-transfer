import { describe, expect, it } from 'vitest';
import {
  ADMIN_GRANT_SECTION_KEYS,
  getAdminSectionForPath,
  hasAdminSectionCapability,
  resolveAdminCapabilities,
} from '@/lib/auth/authorization';

describe('per-person admin grants', () => {
  it('keeps SUPER_ADMIN immutable and fully capable', () => {
    const capabilities = resolveAdminCapabilities('SUPER_ADMIN', []);
    expect(capabilities.dashboard).toEqual({ canView: true, canManage: true });
    expect(hasAdminSectionCapability('SUPER_ADMIN', 'personel', 'manage', [])).toBe(true);
  });

  it('normalizes manage into view and denies omitted sections', () => {
    const grants = [{ section: 'content', canView: false, canManage: true }];
    const capabilities = resolveAdminCapabilities('EDITOR', grants);
    expect(capabilities.content).toEqual({ canView: true, canManage: true });
    expect(capabilities.site_settings).toEqual({ canView: false, canManage: false });
  });

  it('does not fall back for new users without grants', () => {
    const capabilities = resolveAdminCapabilities('CHAT_STAFF', []);
    expect(capabilities.chat.canManage).toBe(false);
    expect(capabilities.account.canManage).toBe(true);
  });

  it('gives CHAT_STAFF only chat when the migration grant exists', () => {
    const capabilities = resolveAdminCapabilities('CHAT_STAFF', [{ section: 'chat', canView: false, canManage: true }]);
    expect(capabilities.chat).toEqual({ canView: true, canManage: true });
    expect(capabilities.chatbot.canView).toBe(false);
    expect(capabilities.newsletter.canView).toBe(false);
  });

  it('maps routes to menu sections and leaves unknown paths unmapped', () => {
    expect(getAdminSectionForPath('/admin/api/staff')).toBe('personel');
    expect(getAdminSectionForPath('/admin/ayarlar')).toBe('site_settings');
    expect(getAdminSectionForPath('/admin/not-a-real-page')).toBeUndefined();
  });

  it('maps canonical API families to the same section as their admin surface', () => {
    expect(getAdminSectionForPath('/admin/api/ai-suggestions')).toBe('ai_content');
    expect(getAdminSectionForPath('/admin/api/vehicle-feature-defaults')).toBe('fleet_pricing');
    expect(getAdminSectionForPath('/admin/api/languages')).toBe('translations');
    expect(getAdminSectionForPath('/admin/api/chatbot/sessions')).toBe('chat');
    expect(getAdminSectionForPath('/admin/api/chatbot/session-id/messages')).toBe('chat');
    expect(getAdminSectionForPath('/admin/api/chatbot/session-id/reply')).toBe('chat');
    expect(getAdminSectionForPath('/admin/api/chatbot/knowledge')).toBe('chatbot');
  });

  it('exposes only grantable domains, never personnel or account', () => {
    expect(ADMIN_GRANT_SECTION_KEYS).not.toContain('personel');
    expect(ADMIN_GRANT_SECTION_KEYS).not.toContain('account');
  });
});