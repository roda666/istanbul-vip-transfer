import {
  buildRequestPresentation,
  type RequestPresentationInput,
  type RequestPresentationSection,
} from '@/lib/admin-request-presentation';

export interface RequestExportRow extends RequestPresentationInput {}

export function parseRequestExportIds(searchParams: Pick<URLSearchParams, 'getAll'>): string[] {
  return Array.from(new Set(
    searchParams
      .getAll('ids')
      .flatMap(value => value.split(','))
      .map(value => value.trim())
      .filter(Boolean),
  )).slice(0, 1000);
}

const headers = ['Referans', 'İsim', 'Telefon', 'E-posta', 'Dil', 'Kaynak', 'Hizmet', 'Talep', 'Durum', 'Kayıt Tarihi'];

const SERVICE_LABELS: Record<string, string> = {
  AIRPORT_TRANSFER: 'Havalimanı / Şehir İçi Transfer',
  INTERCITY: 'Şehirler Arası Transfer',
  ALLOCATION: 'Araç Tahsisi',
  TOUR: 'Özel Tur / Gezi',
  CONTACT_INQUIRY: 'İletişim Talebi',
};
const INTENT_LABELS: Record<string, string> = { QUOTE: 'Fiyat Teklifi', RESERVATION: 'Rezervasyon' };
const STATUS_LABELS: Record<string, string> = {
  NEW: 'Yeni', CONTACTED: 'İletişimde', QUOTED: 'Teklife Gönderildi', CONFIRMED: 'Onaylandı',
  COMPLETED: 'Tamamlandı', CANCELLED: 'İptal', SPAM: 'Spam', ARCHIVED: 'Arşivlendi',
};
const SOURCE_LABELS: Record<string, string> = {
  'contact-form': 'İletişim Formu',
  'booking-form': 'Rezervasyon Formu',
  website: 'Web Sitesi',
};
function text(value: unknown) {
  return String(value ?? '').replace(/[\u0000-\u001F]/g, ' ').trim();
}

function date(value: Date | string) {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function values(row: RequestExportRow) {
  return [
    row.referenceNumber, row.name, row.phone, row.normalizedEmail || '—', row.locale.toUpperCase(),
    SOURCE_LABELS[row.source] ?? row.source, SERVICE_LABELS[row.serviceType] ?? row.serviceType,
    INTENT_LABELS[row.intent] ?? row.intent, STATUS_LABELS[row.status] ?? row.status, date(row.createdAt),
  ].map(text);
}

function detailSections(row: RequestExportRow): RequestPresentationSection[] {
  return buildRequestPresentation(row).filter(section => section.fields.length > 0);
}

export function requestExportFileName(extension: 'xls' | 'pdf') {
  return `talepler-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

/** SpreadsheetML opens natively in Excel without requiring a server-side binary dependency. */
export function requestsToExcel(rows: RequestExportRow[], detailed = rows.length === 1) {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const row = (cells: string[], style?: string) => `<Row>${cells.map(cell => `<Cell${style ? ` ss:StyleID="${style}"` : ''}><Data ss:Type="String">${escape(cell)}</Data></Cell>`).join('')}</Row>`;
  const mergedRow = (value: string, style: string) => `<Row><Cell ss:MergeAcross="1" ss:StyleID="${style}"><Data ss:Type="String">${escape(value)}</Data></Cell></Row>`;
  const tableRows = detailed && rows[0]
    ? [
        mergedRow(`REZERVASYON KARTI · ${rows[0].referenceNumber}`, 'Title'),
        mergedRow(`Oluşturulma: ${date(new Date())}`, 'Subtitle'),
        '<Row />',
        ...detailSections(rows[0]).flatMap(section => [
          mergedRow(section.title, 'Section'),
          ...section.fields.map(item => `<Row><Cell ss:StyleID="Label"><Data ss:Type="String">${escape(item.label)}</Data></Cell><Cell ss:StyleID="Value"><Data ss:Type="String">${escape(item.value)}</Data></Cell></Row>`),
          '<Row />',
        ]),
      ].join('')
    : `${row(headers, 'Header')}${rows.map(item => row(values(item))).join('')}`;
  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Arial" ss:Size="10"/><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style>
  <Style ss:ID="Title"><Font ss:Bold="1" ss:Size="16" ss:Color="#FFFFFF"/><Interior ss:Color="#102A43" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#102A43"/></Borders></Style>
  <Style ss:ID="Subtitle"><Font ss:Italic="1" ss:Color="#52697A"/><Interior ss:Color="#F3F6FA" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1F5D8F" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:WrapText="1"/></Style>
  <Style ss:ID="Section"><Font ss:Bold="1" ss:Size="11" ss:Color="#102A43"/><Interior ss:Color="#DCEAF7" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9FBAD0"/></Borders></Style>
  <Style ss:ID="Label"><Font ss:Bold="1" ss:Color="#334E68"/><Interior ss:Color="#F3F6FA" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders></Style>
  <Style ss:ID="Value"><Font ss:Color="#1E293B"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders></Style>
 </Styles><Worksheet ss:Name="Talepler"><Table><Column ss:Width="145"/><Column ss:Width="360"/>${tableRows}</Table></Worksheet></Workbook>`;
}

function wrap(value: string, max = 78): string[] {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (`${current} ${word}`.trim().length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ['—'];
}

/** A dependency-free PDF reservation card. Turkish glyphs are transliterated for core PDF fonts. */
export function requestsToPdf(rows: RequestExportRow[], detailed = rows.length === 1) {
  const ascii = (value: string) => text(value).replace(/İ/g, 'I').replace(/ı/g, 'i').replace(/Ş/g, 'S').replace(/ş/g, 's').replace(/Ğ/g, 'G').replace(/ğ/g, 'g').replace(/Ü/g, 'U').replace(/ü/g, 'u').replace(/Ö/g, 'O').replace(/ö/g, 'o').replace(/Ç/g, 'C').replace(/ç/g, 'c');
  const escape = (value: string) => ascii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  if (detailed && rows[0]) {
    type Item = { kind: 'title' | 'subtitle' | 'section' | 'field'; label?: string; value: string };
    const items: Item[] = [
      { kind: 'title', value: `REZERVASYON KARTI · ${rows[0].referenceNumber}` },
      { kind: 'subtitle', value: `Olusturulma: ${date(new Date())}` },
      ...detailSections(rows[0]).flatMap((section): Item[] => [
        { kind: 'section', value: section.title },
        ...section.fields.map(item => ({ kind: 'field' as const, label: item.label, value: item.value })),
      ]),
    ];
    const pageContents: string[] = [];
    let commands: string[] = [];
    let y = 790;
    const finishPage = () => {
      pageContents.push(commands.join('\n'));
      commands = [];
      y = 790;
    };
    const itemHeight = (item: Item) => {
      const valueLines = item.kind === 'field' ? wrap(ascii(item.value)) : [ascii(item.value)];
      return item.kind === 'title' ? 52 : item.kind === 'section' ? 38 : item.kind === 'subtitle' ? 30 : 21 + Math.max(0, valueLines.length - 1) * 12;
    };
    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const item = items[itemIndex];
      const valueLines = item.kind === 'field' ? wrap(ascii(item.value)) : [ascii(item.value)];
      const needed = itemHeight(item);
      const requiredSpace = item.kind === 'section' && items[itemIndex + 1]
        ? needed + itemHeight(items[itemIndex + 1])
        : needed;
      if (y - requiredSpace < 48 && commands.length) finishPage();
      if (item.kind === 'title') {
        commands.push(`q 0.063 0.165 0.263 rg 35 ${y - 34} 525 42 re f Q`);
        commands.push(`BT /F2 16 Tf 1 1 1 rg 50 ${y - 18} Td (${escape(item.value)}) Tj ET`);
      } else if (item.kind === 'subtitle') {
        commands.push(`BT /F1 9 Tf 0.32 0.41 0.48 rg 50 ${y - 12} Td (${escape(item.value)}) Tj ET`);
      } else if (item.kind === 'section') {
        commands.push(`q 0.863 0.918 0.969 rg 40 ${y - 27} 515 27 re f Q`);
        commands.push(`BT /F2 11 Tf 0.063 0.165 0.263 rg 50 ${y - 18} Td (${escape(item.value)}) Tj ET`);
      } else {
        commands.push(`BT /F2 9 Tf 0.20 0.31 0.41 rg 50 ${y - 12} Td (${escape(item.label ?? '')}) Tj ET`);
        valueLines.forEach((line, index) => {
          commands.push(`BT /F1 9 Tf 0.12 0.16 0.21 rg 190 ${y - 12 - index * 12} Td (${escape(line)}) Tj ET`);
        });
        commands.push(`q 0.89 0.91 0.94 RG 50 ${y - needed + 5} m 545 ${y - needed + 5} l S Q`);
      }
      y -= needed;
    }
    if (commands.length || !pageContents.length) finishPage();

    const objects: string[] = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      `<< /Type /Pages /Kids [${pageContents.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${pageContents.length} >>`,
    ];
    pageContents.forEach((content, i) => {
      const pageId = 3 + i * 2;
      const contentId = pageId + 1;
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${contentId} 0 R >>`);
      objects.push(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`);
    });
    let output = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => { offsets.push(Buffer.byteLength(output, 'utf8')); output += `${index + 1} 0 obj\n${object}\nendobj\n`; });
    const xref = Buffer.byteLength(output, 'utf8');
    output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(output, 'utf8');
  }

  const lines = [
    'Talepler Raporu',
    `Olusturulma: ${date(new Date())}`,
    '',
    ascii(headers.join(' | ')),
    ...rows.flatMap(item => [
      values(item).join(' | '),
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