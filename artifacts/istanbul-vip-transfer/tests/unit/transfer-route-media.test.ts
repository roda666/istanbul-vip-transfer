import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  isStrictTransferRouteImagePath,
  parseStrictTransferRouteImagePath,
  probeAndOptimizeTransferRouteImage,
} from '../../lib/transfer-route-media';

describe('transfer route media contract', () => {
  it('enlarges a small valid PNG to exactly 1600x900 WebP', async () => {
    const png = await sharp({
      create: { width: 32, height: 18, channels: 3, background: '#765432' },
    }).png().toBuffer();
    const optimized = await probeAndOptimizeTransferRouteImage('image/png', png);
    expect(optimized).not.toBeNull();
    const metadata = await sharp(Buffer.from(optimized!.bytes)).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(1600);
    expect(metadata.height).toBe(900);
  });

  it('rejects malformed bytes and a declared MIME mismatch', async () => {
    expect(await probeAndOptimizeTransferRouteImage('image/png', new Uint8Array([1, 2, 3]))).toBeNull();
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#123456' },
    }).png().toBuffer();
    expect(await probeAndOptimizeTransferRouteImage('image/webp', png)).toBeNull();
  });

  it('parses only canonical UUID transfer-object paths', () => {
    const path = '/api/storage/objects/transfer-routes/istanbul-airport-hotel/550e8400-e29b-41d4-a716-446655440000.webp';
    expect(isStrictTransferRouteImagePath(path)).toBe(true);
    expect(parseStrictTransferRouteImagePath(path)).toEqual({
      entityId: 'transfer-routes/istanbul-airport-hotel/550e8400-e29b-41d4-a716-446655440000.webp',
      slug: 'istanbul-airport-hotel',
      uuid: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(isStrictTransferRouteImagePath('/api/storage/objects/transfer-routes/x/not-a-uuid.webp')).toBe(false);
  });
});