import 'server-only';

import sharp from 'sharp';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MIN_ASPECT_RATIO = 0.8; // Instagram portrait 4:5
const MAX_ASPECT_RATIO = 1.91; // Instagram landscape
const UNSAFE_VISUAL_TERMS = /\b(?:text|logo|brand|watermark|sign|license.?plate|plate|portrait|selfie|face|faces|person|people|human|insan|yüz|yuz|portre|logo|marka|tabela|plaka|yazı|yazi|filigran)\b/i;

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === 'localhost' ||
    host.endsWith('.local') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === '::1';
}

/**
 * Instagram fetches the submitted URL itself, so a usable asset must be a
 * public HTTPS image. We deliberately refuse rather than silently crop or
 * manufacture a derivative: the application has no durable transformed-asset
 * pipeline and a temporary conversion URL would fail at Meta's fetch time.
 */
export async function validateInstagramCoverImage(input: {
  imageUrl: string;
  altText: string | null;
  topic: string;
}) {
  let url: URL;
  try {
    url = new URL(input.imageUrl);
  } catch {
    throw new Error('Instagram için geçerli, herkese açık bir görsel URL’si gerekli.');
  }
  if (url.protocol !== 'https:' || isPrivateHost(url.hostname)) {
    throw new Error('Instagram görseli herkese açık HTTPS üzerinden sunulmalıdır.');
  }
  // We can only make the "never" safety guarantee for assets produced by our
  // constrained studio flow. Arbitrary pasted/uploaded images have no
  // provenance or visual-safety attestations, so they are refused for
  // Instagram instead of being published on trust.
  if (!/^\/api\/storage\/objects\/ai-images\/blog\/[a-z0-9-]+\/[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/i.test(url.pathname)) {
    throw new Error('Instagram için yalnızca güvenli AI Studio blog kapak görseli kullanılabilir; desteklenmeyen varlık reddedildi.');
  }
  const descriptiveText = `${input.altText ?? ''} ${input.topic} ${url.pathname}`;
  if (!input.altText?.trim()) {
    throw new Error('Instagram paylaşımı için konuya özel kapak alt metni gerekli.');
  }
  if (UNSAFE_VISUAL_TERMS.test(descriptiveText)) {
    throw new Error('Instagram için metin, logo/marka, tabela, plaka veya yüz odaklı görsel kullanılamaz.');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'image/avif,image/webp,image/jpeg,image/png' },
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new Error('Instagram kapak görseline erişilemedi.');
  }
  if (!response.ok) throw new Error('Instagram kapak görseli indirilemedi.');
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > MAX_IMAGE_BYTES) throw new Error('Instagram kapak görseli 10 MB sınırını aşıyor.');
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!/^image\/(?:avif|webp|jpeg|png)/.test(contentType)) {
    throw new Error('Instagram için yalnızca JPEG, PNG, WebP veya AVIF kapak görseli kabul edilir.');
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
    throw new Error('Instagram kapak görseli desteklenmeyen boyutta.');
  }
  let metadata: { width?: number; height?: number; format?: string };
  try {
    metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new Error('Instagram kapak görseli geçerli bir raster görsel değil.');
  }
  if (!metadata.width || !metadata.height) throw new Error('Instagram kapak görseli boyutları okunamadı.');
  const ratio = metadata.width / metadata.height;
  if (ratio < MIN_ASPECT_RATIO || ratio > MAX_ASPECT_RATIO) {
    throw new Error('Instagram kapak görseli 4:5 ile 1.91:1 arasında olmalıdır; dönüştürülebilir bir görsel yükleyin.');
  }
  return { width: metadata.width, height: metadata.height, format: metadata.format ?? 'unknown' };
}