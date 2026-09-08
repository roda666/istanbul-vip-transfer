export interface RequestExportRow {
  referenceNumber: string;
  name: string;
  phone: string;
  normalizedEmail: string | null;
  locale: string;
  source: string;
  pageSlug: string;
  serviceType: string;
  intent: string;
  status: string;
  createdAt: Date | string;
}

const headers = ['Referans', 'İsim', 'Telefon', 'E-posta', 'Dil', 'Kaynak', 'Sayfa', 'Hizmet', 'Talep', 'Durum', 'Kayıt Tarihi'];

function text(value: unknown) {
  return String(value ?? '').replace(/[\u0000-\u001F]/g, ' ').trim();
}

function date(value: Date | string) {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function values(row: RequestExportRow) {
  return [row.referenceNumber, row.name, row.phone, row.normalizedEmail, row.locale, row.source, row.pageSlug, row.serviceType, row.intent, row.status, date(row.createdAt)].map(text);
}

export function requestExportFileName(extension: 'xls' | 'pdf') {
  return `talepler-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

/** SpreadsheetML opens natively in Excel without requiring a server-side binary dependency. */
export function requestsToExcel(rows: RequestExportRow[]) {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const row = (cells: string[], header = false) => `<Row>${cells.map(cell => `<Cell${header ? ' ss:StyleID="Header"' : ''}><Data ss:Type="String">${escape(cell)}</Data></Cell>`).join('')}</Row>`;
  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="Header"><Font ss:Bold="1"/></Style></Styles><Worksheet ss:Name="Talepler"><Table>${row(headers, true)}${rows.map(item => row(values(item))).join('')}</Table></Worksheet></Workbook>`;
}

/** A deliberately small, dependency-free PDF table. Turkish glyphs are transliterated for core PDF fonts. */
export function requestsToPdf(rows: RequestExportRow[]) {
  const ascii = (value: string) => text(value).replace(/İ/g, 'I').replace(/ı/g, 'i').replace(/Ş/g, 'S').replace(/ş/g, 's').replace(/Ğ/g, 'G').replace(/ğ/g, 'g').replace(/Ü/g, 'U').replace(/ü/g, 'u').replace(/Ö/g, 'O').replace(/ö/g, 'o').replace(/Ç/g, 'C').replace(/ç/g, 'c');
  const escape = (value: string) => ascii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const lines = [
    'Talepler Raporu',
    `Olusturulma: ${date(new Date())}`,
    '',
    ...rows.flatMap(row => [
      `${row.referenceNumber} | ${row.name} | ${row.phone} | ${row.status}`,
      `${row.serviceType} | ${row.intent} | ${date(row.createdAt)} | ${row.source}`,
    ]),
  ];
  const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / 48)) }, (_, index) => lines.slice(index * 48, (index + 1) * 48));
  const objects: string[] = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`];
  pages.forEach((page, i) => {
    const pageId = 3 + i * 2;
    const contentId = pageId + 1;
    const content = `BT /F1 10 Tf 45 800 Td 14 TL ${page.map((line, lineIndex) => `${lineIndex ? 'T* ' : ''}(${escape(line).slice(0, 170)}) Tj`).join('\n')} ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`);
  });
  let output = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(output, 'utf8')); output += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(output, 'utf8');
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, 'utf8');
}