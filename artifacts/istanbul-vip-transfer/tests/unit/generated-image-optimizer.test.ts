import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  GENERATED_IMAGE_MAX_HEIGHT,
  GENERATED_IMAGE_MAX_WIDTH,
  optimizeGeneratedImage,
} from '../../lib/studio/image-media';

describe('generated image optimizer', () => {
  it('decodes, bounds, strips metadata, and returns WebP bytes', async () => {
    const source = await sharp({
      create: { width: 3_200, height: 1_800, channels: 3, background: '#b5834b' },
    })
      .withMetadata({ exif: { IFD0: { Artist: 'Provider metadata' } } })
      .jpeg()
      .toBuffer();

    const optimized = await optimizeGeneratedImage(source);

    expect(optimized).not.toBeNull();
    const metadata = await sharp(Buffer.from(optimized!)).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBeLessThanOrEqual(GENERATED_IMAGE_MAX_WIDTH);
    expect(metadata.height).toBeLessThanOrEqual(GENERATED_IMAGE_MAX_HEIGHT);
    expect(metadata.exif).toBeUndefined();
  });

  it('rejects bytes that Sharp cannot decode', async () => {
    await expect(optimizeGeneratedImage(new Uint8Array([0, 1, 2, 3]))).resolves.toBeNull();
  });
});