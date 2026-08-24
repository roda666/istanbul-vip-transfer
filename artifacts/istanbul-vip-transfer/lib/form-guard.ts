import 'server-only';
import crypto from 'node:crypto';

export type FormGuardForm = 'reservation' | 'contact';
export type FormGuardCheck = 'valid' | 'too_fast' | 'invalid';

const TOKEN_VERSION = 1;
const MIN_FORM_AGE_MS = 3_000;
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1_000;
const FUTURE_CLOCK_SKEW_MS = 30_000;

function getSigningSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.SESSION_SECRET;
  if (!secret) throw new Error('Form guard signing secret is not configured');
  return secret;
}

function sign(encodedPayload: string): string {
  return crypto.createHmac('sha256', getSigningSecret()).update(encodedPayload).digest('base64url');
}

export function createFormGuardToken(form: FormGuardForm): string {
  const payload = Buffer.from(JSON.stringify({
    v: TOKEN_VERSION,
    form,
    issuedAt: Date.now(),
    nonce: crypto.randomBytes(16).toString('base64url'),
  })).toString('base64url');

  return `${payload}.${sign(payload)}`;
}

export function verifyFormGuardToken(
  token: unknown,
  expectedForm: FormGuardForm,
): FormGuardCheck {
  if (typeof token !== 'string') return 'invalid';

  try {
    const [encodedPayload, encodedSignature] = token.split('.');
    if (!encodedPayload || !encodedSignature) return 'invalid';

    const expectedSignature = sign(encodedPayload);
    const provided = Buffer.from(encodedSignature, 'base64url');
    const expected = Buffer.from(expectedSignature, 'base64url');
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      return 'invalid';
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as {
      v?: unknown;
      form?: unknown;
      issuedAt?: unknown;
      nonce?: unknown;
    };
    if (
      payload.v !== TOKEN_VERSION
      || payload.form !== expectedForm
      || !Number.isInteger(payload.issuedAt)
      || typeof payload.nonce !== 'string'
      || payload.nonce.length < 16
    ) {
      return 'invalid';
    }

    const age = Date.now() - (payload.issuedAt as number);
    if (age < -FUTURE_CLOCK_SKEW_MS || age > MAX_FORM_AGE_MS) return 'invalid';
    if (age < MIN_FORM_AGE_MS) return 'too_fast';
    return 'valid';
  } catch {
    return 'invalid';
  }
}