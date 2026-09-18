import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('safe custom service type deletion', () => {
  it('protects core keys and deletes settings references transactionally', () => {
    const route = source('app/admin/api/service-types/[id]/route.ts');
    expect(route).toContain('export async function DELETE');
    expect(route).toContain('CANONICAL_SERVICE_TYPES');
    expect(route).toContain('db.transaction');
    expect(route).toContain('optionalFieldServiceTypes');
    expect(route).toContain("action: 'DELETE'");
    expect(route).toContain('revalidateBookingFormBootstrap');
    expect(route).not.toContain('reservationRequests');
  });

  it('shows a confirmed delete action while visibly protecting core rows', () => {
    const client = source('app/admin/(protected)/rezervasyon-ayarlari/_ReservasyonAyarlariClient.tsx');
    expect(client).toContain('label="Sil"');
    expect(client).toContain('window.confirm');
    expect(client).toContain('Sistem — silinemez');
    expect(client).toContain('Sistem hizmet türleri silinemez.');
    expect(client).toContain('.json().catch(() => ({}))');
  });
});