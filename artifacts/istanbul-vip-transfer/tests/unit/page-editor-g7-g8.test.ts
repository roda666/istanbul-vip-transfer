import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CUSTOMER_TRANSLATION_LOCALES } from '../../lib/customer-content-translation';
import { findTollFeeViolations } from '../../lib/toll-fee-rules';

const form = readFileSync(resolve(process.cwd(), 'app/admin/_components/ContentForm.tsx'), 'utf8');
const imageField = readFileSync(resolve(process.cwd(), 'app/admin/_components/ImageUploadField.tsx'), 'utf8');
const imageRoute = readFileSync(resolve(process.cwd(), 'app/admin/api/studio/images/route.ts'), 'utf8');
const updateRoute = readFileSync(resolve(process.cwd(), 'app/admin/api/content/[id]/route.ts'), 'utf8');

describe('G7/G8 page editor contract', () => {
  it('keeps every active customer locale in the automatic save translation contract', () => {
    expect(CUSTOMER_TRANSLATION_LOCALES).toEqual(['en', 'de', 'ru', 'ar', 'es', 'fr', 'it', 'nl']);
    expect(updateRoute).toContain('enqueueCustomerContentTranslations');
    expect(updateRoute).toContain('force: true');
    expect(updateRoute).toContain('findTollFeeViolations');
  });

  it('rejects Turkish toll/bridge-fee copy before a save can proceed', () => {
    expect(findTollFeeViolations('Köprü geçiş ücreti dahil.', 'tr')).not.toHaveLength(0);
    expect(findTollFeeViolations('Konforlu ve güvenli transfer hizmeti.', 'tr')).toHaveLength(0);
  });

  it('exposes safe form actions and real AI writing/image controls', () => {
    expect(form).toContain('AI ile Oluştur');
    expect(form).toContain('/admin/api/ai-writing');
    expect(imageField).toContain('Dosya'); // ImageUploadField retains the upload path.
    expect(imageField).toContain("ai.target === 'PAGE' && ai.draftSlug");
    expect(imageRoute).toContain("data.action === 'generate' && !data.id && data.target === 'PAGE'");
    expect(form).toContain('label="İptal"');
    expect(form).toContain('Sil (önce kaydedin)');
    expect(form).toContain('window.confirm');
  });
});