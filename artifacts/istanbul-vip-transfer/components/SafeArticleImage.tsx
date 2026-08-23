import Image from 'next/image';
import { getSafeImageSource, safeImageAlt } from '@/lib/blog-markdown';

interface SafeArticleImageProps {
  src: string;
  alt?: string | null;
  fallbackAlt?: string;
  priority?: boolean;
  quality?: number;
  className?: string;
  sizes: string;
  fill?: boolean;
}

/**
 * Uses Next Image only for local paths and the hosts explicitly allowed by
 * next.config.ts. Other HTTP(S) sources remain a safe, non-optimized image.
 */
export default function SafeArticleImage({
  src, alt, fallbackAlt, priority = false, quality = 75, className, sizes, fill = false,
}: SafeArticleImageProps) {
  const source = getSafeImageSource(src);
  if (!source) return null;
  const imageAlt = safeImageAlt(alt ?? undefined, fallbackAlt);

  if (source.kind === 'optimized') {
    return (
      <Image
        src={source.src}
        alt={imageAlt}
        fill={fill}
        width={fill ? undefined : 1200}
        height={fill ? undefined : 675}
        sizes={sizes}
        quality={quality}
        priority={priority}
        fetchPriority={priority ? 'high' : undefined}
        className={className}
      />
    );
  }

  return (
    // This source has passed protocol and credential validation above.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={source.src}
      alt={imageAlt}
      width={fill ? undefined : 1200}
      height={fill ? undefined : 675}
      sizes={sizes}
      loading={priority ? 'eager' : 'lazy'}
       fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={className}
    />
  );
}