import { describe, expect, it } from 'vitest';
import {
  adminCmsStatusLabel,
  normalizeAdminCmsLanguageStatuses,
  normalizeAdminCmsStatus,
} from '../../lib/admin-cms-status';
import { ADMIN_RECORD_ACTION_ORDER } from '../../app/admin/_components/AdminRecordActions';

describe('shared CMS list standard', () => {
  it('normalizes all persisted translation states without Turkish fallback', () => {
    expect(normalizeAdminCmsStatus('PUBLISHED')).toBe('published');
    expect(normalizeAdminCmsStatus('RUNNING')).toBe('translating');
    expect(normalizeAdminCmsStatus('OUTDATED')).toBe('outdated');
    expect(normalizeAdminCmsStatus('FAILED')).toBe('failed');
    expect(normalizeAdminCmsLanguageStatuses({ en: 'PUBLISHED', ar: 'FAILED' }).tr).toBe('published');
    expect(normalizeAdminCmsLanguageStatuses({ en: 'PUBLISHED', ar: 'FAILED' }).de).toBe('draft');
    expect(adminCmsStatusLabel('outdated')).toBe('Güncel değil');
  });

  it('keeps destructive action last after ordinary and custom actions', () => {
    expect(ADMIN_RECORD_ACTION_ORDER.at(-1)).toBe('delete');
    expect(ADMIN_RECORD_ACTION_ORDER.indexOf('up')).toBeLessThan(ADMIN_RECORD_ACTION_ORDER.indexOf('edit'));
    expect(ADMIN_RECORD_ACTION_ORDER.indexOf('edit')).toBeLessThan(ADMIN_RECORD_ACTION_ORDER.indexOf('delete'));
  });
});