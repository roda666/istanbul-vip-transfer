/**
 * Facebook's official web sharer accepts the public content URL. Facebook
 * fetches the page's existing Open Graph title, description, and image.
 */
export function buildFacebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}