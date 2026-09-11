import { describe, expect, it } from 'vitest';
import * as XLSX from '@e965/xlsx';
import {
  hashPreview,
  MAX_IMPORT_BYTES,
  parseStrictImportDate,
  parseTollImport,
  parseTurkishCurrency,
  validateImportFile,
} from '@/lib/toll-tariff-import';

describe('staged toll import parser contracts', () => {
  function workbook(rows: unknown[][], bookType: 'xlsx' | 'xls' = 'xlsx') {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Tarife');
    return Buffer.from(XLSX.write(book, { type: 'buffer', bookType }));
  }
  it('parses strict Turkish currency forms without splitting grouped numbers', () => {
    expect(parseTurkishCurrency('1250')).toBe(125000);
    expect(parseTurkishCurrency('1.250')).toBe(125000);
    expect(parseTurkishCurrency('1.250,50')).toBe(125050);
    expect(parseTurkishCurrency('1250.50')).toBe(125050);
    expect(parseTurkishCurrency('1.2.50')).toBeNull();
  });

  it('generates and parses valid XLSX through the isolated worker', async () => {
    const parsed = await parseTollImport(workbook([
      ['Sınıf', 'Ücret'],
      ...[1, 2, 3, 4, 5, 6].map((n) => [n, n === 1 ? '₺1.250,50' : `₺${n}250.00`]),
    ]), 'xlsx');
    expect(parsed.rows.map(row => row.amountKurus)).toEqual([125050, 225000, 325000, 425000, 525000, 625000]);
  });

  it('generates and parses legacy XLS through the isolated worker', async () => {
    const parsed = await parseTollImport(workbook([
      ['Sınıf', 'Tarife'],
      ...[1, 2, 3, 4, 5, 6].map((n) => [`Sınıf ${n}`, `₺${n}.250`]),
    ], 'xls'), 'xls');
    expect(parsed.rows.map(row => row.amountKurus)).toEqual([125000, 225000, 325000, 425000, 525000, 625000]);
  });

  it('does not treat axle/count evidence as TRY and marks ambiguity unresolved', async () => {
    const parsed = await parseTollImport(workbook([
      ['Sınıf', 'Ücret', 'Not'],
      ['Sınıf 1', '2 aks', 'ücret açıklanmamış'],
      ['Sınıf 1', '2 aks', '₺1.250'],
      ...[2, 3, 4, 5, 6].map((n) => [`Sınıf ${n}`, '', '']),
    ]), 'xlsx');
    expect(parsed.rows[0].status).toBe('UNRESOLVED');
    expect(parsed.rows[0].amountKurus).toBeNull();
  });

  it('rejects impossible calendar dates, including normalized JavaScript dates', () => {
    expect(parseStrictImportDate('29.02.2024')).not.toBeNull();
    expect(parseStrictImportDate('29.02.2023')).toBeNull();
    expect(parseStrictImportDate('2024-02-30')).toBeNull();
    expect(parseStrictImportDate('31.04.2026')).toBeNull();
  });

  it('requires extension, MIME, magic bytes, and conservative size', async () => {
    const valid = Buffer.from('PK\x03\x04minimal');
    expect(validateImportFile('tarife.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', valid)).toBe('xlsx');
    expect(() => validateImportFile('tarife.xlsx', 'application/pdf', valid)).toThrow();
    expect(() => validateImportFile('tarife.pdf', 'application/pdf', valid)).toThrow();
    expect(() => validateImportFile('tarife.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', Buffer.alloc(MAX_IMPORT_BYTES + 1))).toThrow();
  });

  it('enforces spreadsheet resource caps', async () => {
    await expect(parseTollImport(Buffer.from('PK\x03\x04minimal'), 'xlsx')).rejects.toThrow(/XLSX|güvenli|kaynak/);
  });

  it('hashes immutable preview content and scopes identity inputs by point/admin', () => {
    const base = { rows: [], effectiveDate: '2026-01-01T00:00:00.000Z' };
    expect(hashPreview(base)).toHaveLength(64);
    expect(hashPreview({ ...base, tollPointId: 'point-a', createdBy: 'admin-a' }))
      .not.toBe(hashPreview({ ...base, tollPointId: 'point-b', createdBy: 'admin-a' }));
    expect(hashPreview(base)).toBe(hashPreview(base));
  });
});
