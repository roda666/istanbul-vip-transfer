import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const appRoot = resolve(__dirname, '../..');

const missingOnlyRoutes = [
  'app/admin/api/categories/route.ts',
  'app/admin/api/categories/[id]/route.ts',
  'app/admin/api/faqs/route.ts',
  'app/admin/api/faqs/[id]/route.ts',
  'app/admin/api/locations/route.ts',
  'app/admin/api/locations/[id]/route.ts',
  'app/admin/api/vehicles/[id]/route.ts',
  'app/admin/api/transfer-routes/[id]/route.ts',
  'app/admin/api/blog/[id]/route.ts',
];

describe('translation autofill route contract', () => {
  it.each(missingOnlyRoutes)('%s uses the shared missing-only helper', (relativePath) => {
    const source = readFileSync(resolve(appRoot, relativePath), 'utf8');

    expect(source).toContain('fillMissingTranslations');
  });

  it('keeps vehicle translations on the field-by-locale merge path', () => {
    const source = readFileSync(
      resolve(appRoot, 'app/admin/api/vehicles/[id]/route.ts'),
      'utf8',
    );

    expect(source).toContain('localeFieldMap');
    expect(source).toContain('fieldLocaleMaps');
  });
});