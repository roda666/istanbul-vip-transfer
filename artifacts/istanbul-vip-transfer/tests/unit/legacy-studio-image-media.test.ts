import { describe, expect, it } from 'vitest';
import { verifyLegacyImageFormat } from '../../lib/studio/image-media';

describe('legacy Studio image media verification', () => {
  it('aligns a verified PNG signature with PNG extension and storage MIME type', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    expect(verifyLegacyImageFormat('image/png; charset=binary', png)).toEqual({
      extension: 'png',
      contentType: 'image/png',
    });
  });

  it('rejects a misleading MIME type instead of storing mislabeled bytes', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(verifyLegacyImageFormat('image/webp', png)).toBeNull();
  });
});