import 'server-only';

import crypto from 'node:crypto';
import { fork } from 'node:child_process';
import path from 'node:path';
import yauzl from 'yauzl';

export const TOLL_IMPORT_PARSER_VERSION = '1.0.0';
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
export const MAX_IMPORT_SHEETS = 20;
export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_CELLS = 100_000;
export const MAX_IMPORT_TEXT = 200_000;
const MAX_ENTRY_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED = 32 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;
type ZipEntry = { fileName: string; generalPurposeBitFlag: number; uncompressedSize: number; compressedSize: number };
type ZipLike = { readEntry(): void; close(): void; on(event: string, handler: (...args: never[]) => void): void };
const CLASSES = [1, 2, 3, 4, 5, 6] as const;
type ClassNumber = (typeof CLASSES)[number];
export type ImportRow = {
  classNumber: ClassNumber;
  status: 'RESOLVED' | 'UNRESOLVED';
  amountKurus: number | null;
  reason: string | null;
  evidence: string;
};
export type ParsedImport = {
  rows: ImportRow[];
  effectiveDate: string | null;
  evidenceText: string;
  cells: string[][];
};

const MIME = new Set([
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export function validateImportFile(filename: string, mime: string, bytes: Buffer) {
  if (bytes.length === 0 || bytes.length > MAX_IMPORT_BYTES) throw new Error('Dosya boyutu izin verilen sınırı aşıyor (en fazla 8 MB).');
  const ext = filename.toLowerCase().split('.').pop();
  if (!ext || !['pdf', 'xls', 'xlsx'].includes(ext)) throw new Error('Yalnızca PDF, XLS veya XLSX dosyaları kabul edilir.');
  const expectedMime = ext === 'pdf' ? 'application/pdf' : ext === 'xls' ? 'application/vnd.ms-excel' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (!MIME.has(mime.toLowerCase()) || mime.toLowerCase() !== expectedMime) throw new Error('Dosya MIME türü uzantıyla eşleşmiyor.');
  const pdf = bytes.subarray(0, 5).toString() === '%PDF-';
  const ole = bytes.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'));
  const zip = bytes.subarray(0, 4).equals(Buffer.from('504b0304', 'hex'));
  if ((ext === 'pdf' && !pdf) || (ext === 'xls' && !ole) || (ext === 'xlsx' && !zip)) {
    throw new Error('Dosya uzantısı ile gerçek dosya biçimi eşleşmiyor.');
  }
  return ext as 'pdf' | 'xls' | 'xlsx';
}

export async function preflightXlsxZip(bytes: Buffer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(bytes, { lazyEntries: true, validateEntrySizes: true }, (error: Error | null, zip: ZipLike | null) => {
      if (error || !zip) return reject(new Error('XLSX ZIP yapısı güvenli değil.'));
      let count = 0, total = 0;
      zip.readEntry();
      zip.on('entry', (entry: ZipEntry) => {
        count++;
        const name = entry.fileName.replace(/\\/g, '/');
        if (count > MAX_IMPORT_SHEETS * 20 || name.startsWith('/') || name.split('/').includes('..') || (entry.generalPurposeBitFlag & 1)) {
          zip.close(); reject(new Error('XLSX arşivi güvenlik sınırlarını aşıyor.')); return;
        }
        const size = entry.uncompressedSize;
        total += size;
        if (size > MAX_ENTRY_BYTES || total > MAX_TOTAL_UNCOMPRESSED || (entry.compressedSize > 0 && size / entry.compressedSize > MAX_COMPRESSION_RATIO)) {
          zip.close(); reject(new Error('XLSX arşivi kaynak sınırlarını aşıyor.')); return;
        }
        zip.readEntry();
      });
      zip.on('end', () => resolve());
      zip.on('error', () => reject(new Error('XLSX ZIP okunamadı.')));
    });
  });
}

export function parseTurkishCurrency(raw: string): number | null {
  const normalized = raw.trim().replace(/^(?:₺|TL)\s*/i, '').replace(/\s*(?:₺|TL)$/i, '').replace(/\s/g, '');
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(normalized)
    && !/^\d+\.\d{1,2}$/.test(normalized)) return null;
  const decimal = normalized.includes(',')
    ? normalized.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(?:\.\d{3})+$/.test(normalized) ? normalized.replace(/\./g, '') : normalized;
  const value = Number(decimal);
  if (!Number.isFinite(value) || value <= 0 || value > 10_000_000) return null;
  return Math.round(value * 100);
}

export function parseStrictImportDate(value: string): string | null {
  const iso = value.trim().match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  const m = value.trim().match(/^(\d{1,2})[./-](\d{1,2})-(20\d{2})$/)
    ?? value.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](20\d{2})$/);
  if (iso) {
    const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return date.getUTCFullYear() === Number(iso[1]) && date.getUTCMonth() === Number(iso[2]) - 1 && date.getUTCDate() === Number(iso[3]) ? date.toISOString() : null;
  }
  if (!m) return null;
  const day = Number(m[1]), month = Number(m[2]), year = Number(m[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString();
}

function dateFromText(text: string): string | null {
  const m = text.match(/(?:geçerli(?:dir)?|yürürlük|effective|tarih)[^0-9]{0,30}(\d{1,2})[./-](\d{1,2})[./-](\d{4})/i)
    ?? text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
  if (!m) return null;
  return parseStrictImportDate(`${m[1]}.${m[2]}.${m[3]}`);
}

function rowsFromText(text: string, currencyRequired = true): ImportRow[] {
  return CLASSES.map((classNumber) => {
    const matches = [...text.matchAll(new RegExp(`(?:s[ıi]n[ıi]f|class)\\s*[-:#]?\\s*${classNumber}\\b([^\\n\\r]*)`, 'giu'))];
    const evidence = matches.map(m => m[0].slice(0, 500)).join(' | ').slice(0, 1000);
    if (matches.length !== 1) return { classNumber, status: 'UNRESOLVED', amountKurus: null, reason: matches.length ? 'Sınıf için birden fazla satır bulundu; tutar açıkça tekil değil.' : 'Sınıf 1-6 tutarı belgede açıkça bulunamadı.', evidence };
    // Extract complete numeric/currency tokens; do not split 1250 into 1 + 250.
    const token = currencyRequired
      ? /(?<![\d.,])(?:₺\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:[,.]\d{1,2})?(?:\s*TL|₺)(?![\d.,])/gi
      : /(?<![\d.,])(?:₺\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:[,.]\d{1,2})?(?:\s*TL|₺)?(?![\d.,])/gi;
    const amounts = [...matches[0][1].matchAll(token)]
      .map(m => parseTurkishCurrency(m[0])).filter((v): v is number => v != null);
    if (amounts.length !== 1) return { classNumber, status: 'UNRESOLVED', amountKurus: null, reason: amounts.length ? 'Sınıf satırındaki tutar tekil olarak belirlenemedi.' : 'Sınıf satırında açık bir tutar bulunamadı.', evidence };
    return { classNumber, status: 'RESOLVED', amountKurus: amounts[0], reason: null, evidence };
  });
}

function rowsFromCells(cells: string[][]): ImportRow[] | null {
  const headerIndex = cells.findIndex(row => row.some(v => /s[ıi]n[ıi]f|class/i.test(v))
    && row.some(v => /fiyat|tarife|ücret|ucret|price|fee|toll/i.test(v)));
  if (headerIndex < 0) return null;
  const header = cells[headerIndex];
  const classColumns = header.map((v, i) => /s[ıi]n[ıi]f|class/i.test(v) ? i : -1).filter(i => i >= 0);
  const priceColumns = header.map((v, i) => /fiyat|tarife|ücret|ucret|price|fee|toll/i.test(v) ? i : -1).filter(i => i >= 0);
  return CLASSES.map(classNumber => {
    const matches = cells.slice(headerIndex + 1).filter(row => classColumns.some(i => {
      const classCell = (row[i] ?? '').trim();
      return classCell === String(classNumber)
        || new RegExp(`^(?:s[ıi]n[ıi]f|class)\\s*${classNumber}$`, 'i').test(classCell);
    }));
    const evidence = matches.map(row => row.join(' | ')).join(' | ').slice(0, 1000);
    const amounts = matches.flatMap(row => priceColumns.map(i => parseTurkishCurrency(row[i] ?? '')).filter((v): v is number => v != null));
    if (matches.length !== 1 || amounts.length !== 1) return { classNumber, status: 'UNRESOLVED', amountKurus: null, reason: matches.length > 1 || amounts.length > 1 ? 'Sınıf ve ücret eşleşmesi belirsiz.' : 'Sınıf için açık ücret bulunamadı.', evidence };
    return { classNumber, status: 'RESOLVED', amountKurus: amounts[0], reason: null, evidence };
  });
}

async function runWorker(bytes: Buffer, extension: 'pdf' | 'xls' | 'xlsx'): Promise<{ text: string; cells: string[][] }> {
  const workerPath = path.join(process.cwd(), 'lib', 'toll-import-worker.cjs');
  const worker = fork(workerPath, [], { execArgv: ['--max-old-space-size=128'] });
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { worker.kill('SIGKILL'); reject(new Error('Belge işleme zaman aşımına uğradı.')); }, 15_000);
    worker.once('message', (raw: unknown) => {
      const message = raw as { error?: boolean; text: string; cells: string[][] };
      clearTimeout(timer); worker.kill();
      if (message.error) reject(new Error('Belge güvenli biçimde işlenemedi.'));
      else resolve(message);
    });
    worker.once('error', () => { clearTimeout(timer); reject(new Error('Belge güvenli biçimde işlenemedi.')); });
    worker.send({ extension, data: bytes.toString('base64') });
  });
}

export async function parseTollImport(bytes: Buffer, extension: 'pdf' | 'xls' | 'xlsx'): Promise<ParsedImport> {
  if (extension === 'xlsx') await preflightXlsxZip(bytes);
  let text = '';
  let cells: string[][] = [];
  const result = await runWorker(bytes, extension);
  text = result.text; cells = result.cells;
  if (text.length > MAX_IMPORT_TEXT || cells.length > MAX_IMPORT_ROWS || cells.flat().length > MAX_IMPORT_CELLS) throw new Error('Belge kaynak sınırlarını aşıyor.');
  return { rows: cells.length ? (rowsFromCells(cells) ?? rowsFromText(text)) : rowsFromText(text), effectiveDate: dateFromText(text), evidenceText: text.slice(0, 20_000), cells: cells.slice(0, 1000) };
}

export function hashPreview(preview: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(preview)).digest('hex');
}