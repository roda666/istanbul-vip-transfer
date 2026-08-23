/** Pure media checks shared by server-side image storage flows and unit tests. */
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