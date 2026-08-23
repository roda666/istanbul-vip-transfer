export type TelegramShareInput = {
  title: string;
  url: string;
};

/** Builds Telegram's official browser share URL without a bot or API connection. */
export function buildTelegramShareUrl({ title, url }: TelegramShareInput): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title.trim())}`;
}