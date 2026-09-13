import { describe, expect, it, vi } from 'vitest';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '10.0.0.8', family: 4 }]),
}));

import { classifyPublicHttpsUrl } from '../../lib/secure-image-import';

describe('secure image import URL classifications', () => {
  it('distinguishes protocol, localhost, literal and private DNS failures', async () => {
    await expect(classifyPublicHttpsUrl('http://images.example/a.png')).resolves.toEqual({ ok: false, reason: 'non_https' });
    await expect(classifyPublicHttpsUrl('https://localhost/a.png')).resolves.toEqual({ ok: false, reason: 'localhost' });
    await expect(classifyPublicHttpsUrl('https://8.8.8.8/a.png')).resolves.toEqual({ ok: false, reason: 'ip_literal' });
    await expect(classifyPublicHttpsUrl('https://10.0.0.8/a.png')).resolves.toEqual({ ok: false, reason: 'private_address' });
    await expect(classifyPublicHttpsUrl('https://images.example/a.png')).resolves.toEqual({ ok: false, reason: 'dns_private' });
  });
});