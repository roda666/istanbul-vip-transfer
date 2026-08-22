import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from '../../lib/json-ld';

describe('JSON-LD serialization', () => {
  it('prevents stored FAQ and translated SEO text from closing an inline script tag', () => {
    const payload = {
      question: '</script><script>alert("stored-xss")</script>',
      answer: 'Safe answer',
      metaTitle: '</script><script>alert("translated-seo-xss")</script>',
    };
    const serialized = serializeJsonLd(payload);

    expect(serialized).not.toContain('</script>');
    expect(serialized).toContain('\\u003c/script\\u003e');
    expect(JSON.parse(serialized)).toEqual(payload);
  });
});