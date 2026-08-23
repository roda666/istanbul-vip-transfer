/**
 * Cache contract shared by the public chrome reader and CMS mutation handlers.
 * Kept dependency-free so invalidation paths do not load public data readers.
 */
export const PUBLIC_CHROME_TAG = 'public-chrome';
export const PUBLIC_CHROME_REVALIDATE_SECONDS = 300;