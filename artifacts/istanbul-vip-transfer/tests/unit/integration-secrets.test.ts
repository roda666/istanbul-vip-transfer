import { describe, expect, it } from 'vitest';
import { EDITABLE_INTEGRATION_KEYS, INTEGRATION_CATALOG, isEditableIntegrationKey, isManagedIntegrationKey, maskSecret, resolveEnvironmentOnlyIntegrationConfig, resolveIntegrationSecretWithReader } from '@/lib/integration-secrets';
import { openIntegrationSecret, sealIntegrationSecret } from '@/lib/integration-secrets-crypto';
import crypto from 'node:crypto';

describe('integration secret catalog', () => {
  it('has an explicit allowlist and masks only the final four characters', () => {
    expect(isEditableIntegrationKey('OPENAI_API_KEY')).toBe(true);
    expect(isEditableIntegrationKey('AUTH_SECRET')).toBe(false);
    expect(isManagedIntegrationKey('SMTP_PASS')).toBe(true);
    expect(isManagedIntegrationKey('TURNSTILE_SECRET')).toBe(true);
    for (const key of ['X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET', 'X_BEARER_TOKEN', 'AI_INTEGRATIONS_OPENAI_BASE_URL']) {
      expect(isManagedIntegrationKey(key)).toBe(false);
      expect(INTEGRATION_CATALOG.find(entry => entry.key === key)?.editable).toBe(false);
    }
    expect(EDITABLE_INTEGRATION_KEYS).toContain('GOOGLE_CLIENT_SECRET');
    expect(maskSecret('abcdefgh')).toBe('••••efgh');
    expect(maskSecret('abc')).toBe('••••abc');
    expect(maskSecret('')).toBeNull();
    expect(INTEGRATION_CATALOG.every((entry) => !('value' in entry) && !('ciphertext' in entry))).toBe(true);
  });
  it('reads environment-only endpoint configuration without a database reader', () => {
    const previous = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = 'https://trusted.example';
    expect(resolveEnvironmentOnlyIntegrationConfig('AI_INTEGRATIONS_OPENAI_BASE_URL')).toBe('https://trusted.example');
    if (previous === undefined) delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    else process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = previous;
  });
  it('prefers a decryptable database value, falls back to env only when absent, and fails closed when invalid', async () => {
    const env = { OPENAI_API_KEY: 'environment-value' };
    expect(await resolveIntegrationSecretWithReader('OPENAI_API_KEY', async () => 'db', env, async () => 'database-value')).toBe('database-value');
    expect(await resolveIntegrationSecretWithReader('OPENAI_API_KEY', async () => null, env, async () => null)).toBe('environment-value');
    expect(await resolveIntegrationSecretWithReader('OPENAI_API_KEY', async () => 'tampered', env, async () => null)).toBeUndefined();
  });
});

describe('integration envelope ciphertext', () => {
  it('round trips and rejects authentication tampering', () => {
    const key = crypto.randomBytes(32);
    const ciphertext = sealIntegrationSecret(Buffer.from('secret-value'), key);
    expect(openIntegrationSecret(ciphertext, key)?.toString()).toBe('secret-value');
    expect(openIntegrationSecret(`${ciphertext}x`, key)).toBeNull();
  });
});