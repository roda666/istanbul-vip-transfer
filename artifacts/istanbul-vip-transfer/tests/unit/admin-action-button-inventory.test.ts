import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Keep every protected admin surface in the inventory. Native controls are
 * allowed only when they are explicitly listed as non-actions below; this
 * keeps a new CRUD button from silently bypassing the shared primitive.
 */
const excludedSurfaceFragments = [
  '/personel/',
  '/_PersonelClient.tsx',
  '/_TollManagementClient.tsx',
];

const mutationLabelPattern = /\b(?:Ekle|Yeni|Düzenle|Kaydet|Aktifleştir|Pasifleştir|Arşivle|Sil|Vazgeç|İptal|Yukarı|Aşağı|Ata|Kapat|Onayla|Yayınla|Bağlantıyı Kes)\b/i;

function isNonMutationControl(button: string): boolean {
  return /role=["']tab["']/i.test(button)
    || /setActiveTab\(/i.test(button)
    || /aria-label=["'][^"']*(?:kapat|Şifreyi göster|Şifreyi gizle|Parolayı göster|Parolayı gizle)[^"']*["']/i.test(button)
    || /aria-expanded=/i.test(button)
    || /(?:onClose|closeModal|retry|yeniden dene|load|reload|fetch)/i.test(button);
}

function collectCanonicalFiles(root: string, directory = 'app/admin/(protected)'): string[] {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return collectCanonicalFiles(root, relative);
    return entry.name.endsWith('.tsx') ? [relative] : [];
  }).filter((file) => !excludedSurfaceFragments.some((fragment) => file.includes(fragment)));
}

describe('admin action-button inventory', () => {
  it('is machine-readable and records unmanaged mutation patterns', () => {
    const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
    const canonicalFiles = [
      'app/admin/_components/AdminRecordActions.tsx',
      'app/admin/_components/ContentForm.tsx',
      ...collectCanonicalFiles(root),
    ];
    const inventory = canonicalFiles.map((relativePath) => {
      const source = readFileSync(resolve(root, relativePath), 'utf8');
      const unmanaged = (source.match(/<button\b[\s\S]*?<\/button>/gi) ?? [])
        .filter((button) => !button.includes('data-admin-action'))
        .filter((button) => mutationLabelPattern.test(button))
        .filter((button) => !isNonMutationControl(button));
      return {
        file: relativePath,
        usesSharedPrimitive: source.includes('AdminActionButton'),
        unmanagedMutationButtonCount: unmanaged.length,
      };
    });

    // The manifest is useful to CI/reporting tools without requiring a build.
    process.stdout.write(`${JSON.stringify(inventory)}\n`);
    expect(inventory.length).toBeGreaterThan(20);
    expect(inventory.reduce((total, entry) => total + entry.unmanagedMutationButtonCount, 0)).toBe(0);
    expect(inventory.some((entry) => entry.file.endsWith('_VehicleForm.tsx') && entry.usesSharedPrimitive)).toBe(true);
    expect(inventory.some((entry) => entry.file.endsWith('_OptionalServicesClient.tsx') && entry.usesSharedPrimitive)).toBe(true);
  });
});
