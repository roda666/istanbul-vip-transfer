import assert from 'node:assert/strict';
import { buildEmailLink, normalizeEmailLinkBaseUrl } from '@/lib/email-link-url';

const unsafeFragments = ['0.0.0.0', 'localhost', '127.0.0.1'];

function assertSafeEmailLink(url: string | null, description: string): asserts url is string {
  assert.ok(url, `${description}: a link should have been created.`);
  const parsed = new URL(url);
  assert.equal(parsed.protocol, 'https:', `${description}: links must always use HTTPS.`);
  assert.equal(parsed.port, '', `${description}: links must never contain a port.`);
  for (const fragment of unsafeFragments) {
    assert.ok(!url.includes(fragment), `${description}: unsafe host fragment "${fragment}" leaked into the link.`);
  }
}

const configured = normalizeEmailLinkBaseUrl('https://preview.example.replit.dev/');
assert.equal(configured, 'https://preview.example.replit.dev');
const confirmation = buildEmailLink(configured, '/newsletter/confirm', { token: 'safe-token' });
assertSafeEmailLink(confirmation, 'configured newsletter confirmation');

const normalizedWithPort = normalizeEmailLinkBaseUrl('http://preview.example.replit.dev:26004/ignored-path');
assert.equal(normalizedWithPort, 'https://preview.example.replit.dev');
const reset = buildEmailLink(normalizedWithPort, '/admin/login/reset-password', { token: 'safe-token' });
assertSafeEmailLink(reset, 'normalized password reset');

for (const unsafeInput of [
  'http://0.0.0.0:26004',
  'https://localhost:3000',
  'https://127.0.0.1:26004',
  'notaurl',
]) {
  assert.equal(normalizeEmailLinkBaseUrl(unsafeInput), null, `unsafe input must be rejected: ${unsafeInput}`);
}

assert.equal(buildEmailLink(null, '/newsletter/unsubscribe', { token: 'safe-token' }), null);
console.log('email link safety tests passed');