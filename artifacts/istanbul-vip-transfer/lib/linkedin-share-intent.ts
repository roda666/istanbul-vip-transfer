/** Builds LinkedIn's official browser share URL without an API connection. */
export function buildLinkedInShareUrl(url: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}