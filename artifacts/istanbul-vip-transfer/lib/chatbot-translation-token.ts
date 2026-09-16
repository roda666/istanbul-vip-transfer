import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ChatbotLanguage } from '@/lib/chatbot-language';

const TTL_MS = 5 * 60 * 1000;

function secret(): string {
  const value = process.env.CHATBOT_TRANSLATION_TOKEN_SECRET
    ?? process.env.AUTH_SECRET
    ?? process.env.SESSION_SECRET;
  if (!value) throw new Error('chatbot_translation_token_secret_missing');
  return value;
}

export type TranslationTokenPayload = {
  sid: string;
  source: string;
  target: ChatbotLanguage;
  translation: string;
  exp: number;
};

export function createTranslationToken(payload: Omit<TranslationTokenPayload, 'exp'>): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + TTL_MS }), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyTranslationToken(token: unknown): TranslationTokenPayload | null {
  if (typeof token !== 'string') return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = createHmac('sha256', secret()).update(body).digest('base64url');
  if (signature.length !== expected.length
      || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TranslationTokenPayload;
    return payload.exp > Date.now() && typeof payload.sid === 'string'
      && typeof payload.source === 'string' && typeof payload.translation === 'string'
      ? payload
      : null;
  } catch {
    return null;
  }
}
