const imageUrl = '/_next/image?url=%2Fhero-images%2Fvip-transfer.jpg';
const imageSrcSet = [64, 128, 256, 320, 384, 390, 640, 768, 1024, 1280, 1440, 1920]
  .map((width) => `${imageUrl}&w=${width}&q=60 ${width}w`)
  .join(', ');

/**
 * The VIP hero is above the fold, but its source is supplied by a client
 * component. Put a matching responsive preload in the document head so the
 * browser can start the optimized image request before hydration.
 */
export default function Head() {
  return (
    <link
      rel="preload"
      as="image"
      href={`${imageUrl}&w=1920&q=60`}
      imageSrcSet={imageSrcSet}
      imageSizes="(max-width: 768px) calc(100vw - 2.5rem), 720px"
      fetchPriority="high"
    />
  );
}