import { describe, expect, it } from 'vitest';
import { isEligibleServiceTranslation } from '../../lib/translation-publication-policy';

const approved = {
  entityType: 'service_page', status: 'APPROVED', sourceStatus: 'PUBLISHED',
  sourceIsActive: true, languageEnabled: true, languagePublished: true,
};

describe('task #86 bulk service translation publication policy', () => {
  it('allows only visitor-ready approved or scheduled service translations', () => {
    expect(isEligibleServiceTranslation(approved)).toBe(true);
    expect(isEligibleServiceTranslation({ ...approved, status: 'DRAFT' })).toBe(false);
    expect(isEligibleServiceTranslation({ ...approved, status: 'SCHEDULED' })).toBe(true);
  });

  it('rejects inactive/unpublished sources, passive locales, and other entities', () => {
    for (const change of [
      { sourceIsActive: false },
      { sourceStatus: 'DRAFT' },
      { languageEnabled: false },
      { languagePublished: false },
      { entityType: 'content' },
    ]) expect(isEligibleServiceTranslation({ ...approved, ...change })).toBe(false);
  });
});