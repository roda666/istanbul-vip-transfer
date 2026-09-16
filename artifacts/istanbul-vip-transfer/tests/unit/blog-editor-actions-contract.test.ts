import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const editor = fs.readFileSync(path.join(root, 'app/admin/(protected)/blog/_BlogEditor.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app/admin/api/blog/[id]/route.ts'), 'utf8');

describe('Blog editor action contract', () => {
  it('uses stable status-scoped action ids and only one archived-to-draft action', () => {
    expect(editor).toContain("id: `${currentStatus}:${action}`");
    const archivedBranch = editor.slice(
      editor.indexOf("currentStatus === 'ARCHIVED'"),
      editor.indexOf('return (', editor.indexOf("currentStatus === 'ARCHIVED'")),
    );
    expect(archivedBranch.match(/add\('toDraft'/g)).toHaveLength(1);
  });

  it('exposes dirty-safe cancel, unload protection, safe delete and atomic publish controls', () => {
    expect(editor).toContain("window.addEventListener('beforeunload'");
    expect(editor).toContain('Kaydedilmemiş değişiklikler');
    expect(editor).toContain('label="İptal"');
    expect(editor).toContain('label="Sil"');
    expect(editor).toContain('label="8 Dile Çevir ve Yayınla"');
    expect(editor).not.toContain('label="Kaydet ve Yayımla"');
  });

  it('keeps Blog deletion type-limited, permission-gated and dependency-aware', () => {
    expect(route).toContain("eq(content.contentType, 'BLOG_POST')");
    expect(route).toContain('session.capabilities.content.canManage');
    expect(route).toContain("action === 'publishAllLanguages'");
    expect(route).toContain('internalReferenceCount');
    expect(route).toContain('invalidatePublicBlogCache');
  });
});