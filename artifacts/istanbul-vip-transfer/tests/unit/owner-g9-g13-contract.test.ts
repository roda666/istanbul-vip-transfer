import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('owner G9-G13 UI and AI contracts', () => {
  it('uses one spaced service card list with no copy/table fallback and safe delete everywhere', () => {
    const list = read('app/admin/(protected)/hizmetler/_HizmetlerList.tsx');
    expect(list).toContain('AdminCmsRecordCard');
    expect(list).toMatch(/\.hl-cards\s*\{\s*display:\s*flex;\s*flex-direction:\s*column;\s*gap:\s*8px;/);
    expect(list).not.toMatch(/hl-table-wrap|hl-table-row|onDuplicate|handleDuplicate|Kopyala/);
    expect(list).toContain('Bu satırın veritabanında silinebilecek bir hizmet kaydı yok.');
    expect(list).toMatch(/delete=\{\{[\s\S]*?onClick:\s*\(\)\s*=>\s*onDelete\(item\)/);
  });

  it('accepts schema AI fields and forwards current service context into the prompt', () => {
    const route = read('app/admin/api/ai-writing/route.ts');
    const studio = read('lib/studio/ai-studio.ts');
    for (const field of ['schema_service_type', 'schema_opening_hours', 'schema_price_range', 'schema_languages']) {
      expect(route).toContain(`'${field}'`);
      expect(studio).toContain(`'${field}'`);
    }
    expect(route).toMatch(/sourceContext:\s*z\.string\(\)\.max\(12_000\)\.optional\(\)/);
    expect(studio).toContain('<hizmet_baglamı>');
  });

  it('keeps only archive and translate/publish in the source status machine', () => {
    const blog = read('app/admin/(protected)/blog/_BlogEditor.tsx');
    const machine = blog.slice(blog.indexOf('function SourceStatusButtons'), blog.indexOf('// ── Render'));
    expect(machine).toContain('Arşivle');
    expect(machine).toContain('8 Dile Çevir ve Yayınla');
    expect(machine).not.toMatch(/Fikre Döndür|Araştırmaya Gönder|İncelemeye Gönder|Taslağa Döndür|Onayla|Planla|Yayımı Kaldır/);
  });

  it('renders draft/share actions only in the bottom group and removes normal Save', () => {
    const blog = read('app/admin/(protected)/blog/_BlogEditor.tsx');
    const top = blog.slice(blog.indexOf('data-testid="blog-top-status"'), blog.indexOf('{publishTasks.length'));
    const bottom = blog.slice(blog.indexOf('data-testid="blog-bottom-actions"'), blog.indexOf('/* ── Translation Tabs'));
    expect(top).not.toMatch(/FacebookShareButton|Taslak Kaydet|label="Kaydet"|label="İptal"|label="Sil"/);
    expect(bottom).toMatch(/FacebookShareButton[\s\S]*Taslak Kaydet[\s\S]*label="İptal"[\s\S]*label="Sil"/);
    expect(blog).not.toContain('label="Kaydet"');
  });
});