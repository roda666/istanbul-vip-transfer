import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADMIN_RECORD_ACTION_ORDER } from '../../app/admin/_components/AdminRecordActions';

const listScreens: Array<{ file: string; component?: string }> = [
  { file: 'app/admin/(protected)/blog/page.tsx', component: 'ContentList' },
  { file: 'app/admin/(protected)/hizmetler/_HizmetlerList.tsx' },
  { file: 'app/admin/(protected)/araclar/_AraclarList.tsx' },
  { file: 'app/admin/(protected)/soforler/_DriversClient.tsx' },
  { file: 'app/admin/(protected)/kategoriler/page.tsx' },
  { file: 'app/admin/(protected)/rakipler/page.tsx' },
  { file: 'app/admin/(protected)/personel/_PersonelClient.tsx' },
  { file: 'app/admin/(protected)/menu/page.tsx' },
  { file: 'app/admin/(protected)/transfer-rotalari/_TransferRotalariList.tsx' },
  { file: 'app/admin/(protected)/sss/page.tsx' },
  { file: 'app/admin/(protected)/ek-hizmetler/_OptionalServicesClient.tsx' },
  { file: 'app/admin/(protected)/talepler/_TaleplerClient.tsx' },
  { file: 'app/admin/(protected)/chatbot-bilgi-bankasi/_ChatbotKnowledgeClient.tsx' },
  { file: 'app/admin/(protected)/rezervasyon-ayarlari/_ReservasyonAyarlariClient.tsx' },
  { file: 'app/admin/(protected)/dil-ve-ceviri/_DilVeCeviriClient.tsx' },
  { file: 'app/admin/(protected)/yol-gecis-ucretleri/_TollManagementClient.tsx' },
];

describe('admin record action standard', () => {
  it('keeps the Categories order as the shared canonical order', () => {
    expect(ADMIN_RECORD_ACTION_ORDER).toEqual([
      'up', 'down', 'edit', 'activation', 'archive', 'custom', 'delete',
    ]);
  });

  it('keeps every sidebar list screen on the shared action component', () => {
    const root = resolve(__dirname, '../..');
    const unmanagedScreens = listScreens.filter(({ file, component = 'AdminRecordActions' }) => {
      const source = readFileSync(resolve(root, file), 'utf8');
      return !source.includes(component);
    });
    expect(unmanagedScreens).toEqual([]);
  });

  it('exposes stable desktop/mobile markers for browser acceptance checks', () => {
    const root = resolve(__dirname, '../..');
    const source = readFileSync(resolve(root, 'app/admin/_components/AdminRecordActions.tsx'), 'utf8');
    expect(source).toContain('data-admin-record-actions');
    expect(source).toContain('data-admin-action-order');
    expect(source).toContain('data-admin-actions-desktop');
    expect(source).toContain('data-admin-actions-mobile-trigger');
    expect(source).toContain('data-admin-actions-mobile-sheet');
  });
});