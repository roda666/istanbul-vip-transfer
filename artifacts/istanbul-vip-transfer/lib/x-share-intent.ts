export type XShareIntentInput = {
  title: string;
  summary?: string | null;
  url: string;
};

const MAX_SHARE_TEXT_LENGTH = 240;

function compactText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Builds X's official web-intent URL without requiring an API connection,
 * OAuth token, or a server-side publish action.
 */
export function buildXShareIntentUrl({ title, summary, url }: XShareIntentInput): string {
  const text = [compactText(title), summary ? compactText(summary) : '']
    .filter(Boolean)
    .join('\n\n')
    .slice(0, MAX_SHARE_TEXT_LENGTH);

  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}