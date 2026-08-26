import sharp from 'sharp';

/** Server-side media checks shared by image storage flows and unit tests. */
export type VerifiedImageFormat = {
  extension: 'png' | 'webp';
  contentType: 'image/png' | 'image/webp';
};

/** Only accept formats whose MIME type and file signature agree. */
export function verifyLegacyImageFormat(
  contentType: string | null,
  bytes: Uint8Array,
): VerifiedImageFormat | null {
  const mime = contentType?.split(';', 1)[0].trim().toLowerCase();
  const isPng = bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (mime === 'image/png' && isPng) return { extension: 'png', contentType: 'image/png' };

  const isWebp = bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (mime === 'image/webp' && isWebp) return { extension: 'webp', contentType: 'image/webp' };
  return null;
}

/**
 * Bounds for permanent AI-generated cover images. GPT Image returns a 3:2
 * landscape source, while public blog covers use a 16:9 frame. Normalize
 * permanent sources to that display ratio so the public page never needs to
 * add a second, browser-side crop.
 */
export const GENERATED_IMAGE_MAX_WIDTH = 1_600;
export const GENERATED_IMAGE_MAX_HEIGHT = 900;
const MAX_GENERATED_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_GENERATED_IMAGE_PIXELS = 40_000_000;

/**
 * Decode and normalize an AI image for permanent storage.
 *
 * Sharp's output pipeline deliberately does not call `withMetadata()`, so
 * EXIF/XMP/IPTC and other unnecessary source metadata are not copied to the
 * stored WebP. `null` is intentionally returned for malformed or unsafe input
 * so callers can surface their existing generic image error without exposing
 * decoder/provider details.
 */
export async function optimizeGeneratedImage(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_GENERATED_IMAGE_BYTES) return null;

  try {
    const source = sharp(Buffer.from(bytes), {
      failOn: 'error',
      limitInputPixels: MAX_GENERATED_IMAGE_PIXELS,
      sequentialRead: true,
    });
    const metadata = await source.metadata();
    if (!metadata.width || !metadata.height) return null;

    const targetRatio = GENERATED_IMAGE_MAX_WIDTH / GENERATED_IMAGE_MAX_HEIGHT;
    const cropWidth = metadata.width > metadata.height * targetRatio
      ? Math.floor(metadata.height * targetRatio)
      : metadata.width;
    const cropHeight = metadata.height > metadata.width / targetRatio
      ? Math.floor(metadata.width / targetRatio)
      : metadata.height;
    const cropLeft = Math.floor((metadata.width - cropWidth) / 2);
    const cropTop = Math.floor((metadata.height - cropHeight) / 2);

    const output = await source
      .rotate()
      .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
      .resize({
        width: GENERATED_IMAGE_MAX_WIDTH,
        height: GENERATED_IMAGE_MAX_HEIGHT,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 5, smartSubsample: true })
      .toBuffer();

    // Verify the encoded result as well as the source: storage must only ever
    // receive a bounded WebP, even if a decoder behavior changes.
    const result = await sharp(output, {
      failOn: 'error',
      limitInputPixels: MAX_GENERATED_IMAGE_PIXELS,
    }).metadata();
    if (
      result.format !== 'webp'
      || !result.width
      || !result.height
      || result.width > GENERATED_IMAGE_MAX_WIDTH
      || result.height > GENERATED_IMAGE_MAX_HEIGHT
      || output.byteLength === 0
      || output.byteLength > MAX_GENERATED_IMAGE_BYTES
    ) {
      return null;
    }

    return new Uint8Array(output);
  } catch {
    return null;
  }
}

/**
 * If `bytes` (already a valid WebP at the standard 1600x900 dimensions) is
 * larger than `maxBytes`, re-encode at progressively lower quality/higher
 * effort until it fits, without going below a quality floor considered
 * visually lossless for photographic content. Dimensions never change.
 *
 * Returns the original bytes unchanged when already under budget, or on any
 * decode/encode failure (never throws, never returns something larger than
 * the input). `recompressed` tells the caller whether re-encoding happened.
 */
const RECOMPRESS_QUALITY_STEPS = [82, 76, 70, 64] as const;

export async function recompressWebpToBudget(
  bytes: Uint8Array,
  maxBytes: number,
): Promise<{ bytes: Uint8Array; recompressed: boolean }> {
  if (bytes.byteLength <= maxBytes) return { bytes, recompressed: false };

  try {
    let best = bytes;
    for (const quality of RECOMPRESS_QUALITY_STEPS) {
      const candidate = await sharp(Buffer.from(bytes), {
        failOn: 'error',
        limitInputPixels: MAX_GENERATED_IMAGE_PIXELS,
      })
        .webp({ quality, effort: 6, smartSubsample: true })
        .toBuffer();
      if (candidate.byteLength === 0) continue;
      if (candidate.byteLength < best.byteLength) best = new Uint8Array(candidate);
      if (candidate.byteLength <= maxBytes) return { bytes: new Uint8Array(candidate), recompressed: true };
    }
    // Never found a step under budget — keep the smallest valid result
    // reached at the quality floor rather than degrading further.
    return { bytes: best, recompressed: best.byteLength < bytes.byteLength };
  } catch {
    return { bytes, recompressed: false };
  }
}