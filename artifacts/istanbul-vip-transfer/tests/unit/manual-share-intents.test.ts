import { describe, expect, it } from 'vitest';
import { buildLinkedInShareUrl } from '@/lib/linkedin-share-intent';
import { buildTelegramShareUrl } from '@/lib/telegram-share-intent';

describe('manual social share intents', () => {
  it('encodes a public post URL for LinkedIn without requiring an API connection', () => {
    const url = 'https://www.istanbulviptransfer.com/blog/istanbul-havalimanı-rehberi?ref=admin share';

    expect(buildLinkedInShareUrl(url)).toBe(
      'https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fwww.istanbulviptransfer.com%2Fblog%2Fistanbul-havaliman%C4%B1-rehberi%3Fref%3Dadmin%20share',
    );
  });

  it('encodes both title and public post URL for Telegram', () => {
    const href = buildTelegramShareUrl({
      title: '  İstanbul Havalimanı & VIP Transfer  ',
      url: 'https://www.istanbulviptransfer.com/blog/istanbul-havalimani',
    });

    expect(href).toBe(
      'https://t.me/share/url?url=https%3A%2F%2Fwww.istanbulviptransfer.com%2Fblog%2Fistanbul-havalimani&text=%C4%B0stanbul%20Havaliman%C4%B1%20%26%20VIP%20Transfer',
    );
  });
});