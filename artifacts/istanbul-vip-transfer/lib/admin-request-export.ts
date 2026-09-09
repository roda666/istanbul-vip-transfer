import {
  buildRequestListPresentation,
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

function text(value: unknown) {
  return String(value ?? '').replace(/[\u0000-\u001F]/g, ' ').trim();
}

function date(value: Date | string) {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function values(row: RequestExportRow) {
  return buildRequestListPresentation(row).values.map(text);
}

function headers(row?: RequestExportRow) {
  return row ? buildRequestListPresentation(row).headers : buildRequestListPresentation({
    referenceNumber: '', name: '', phone: '', normalizedEmail: null, locale: '',
    source: '', serviceType: '', intent: '', status: '', createdAt: new Date(0),
  }).headers;
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
    : `${row(headers(rows[0]), 'Header')}${rows.map(item => row(values(item))).join('')}`;
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
  const ascii = (value: string) => text(value).replace(/[–—]/g, '-').replace(/İ/g, 'I').replace(/ı/g, 'i').replace(/Ş/g, 'S').replace(/ş/g, 's').replace(/Ğ/g, 'G').replace(/ğ/g, 'g').replace(/Ü/g, 'U').replace(/ü/g, 'u').replace(/Ö/g, 'O').replace(/ö/g, 'o').replace(/Ç/g, 'C').replace(/ç/g, 'c');
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

  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 24;
  const tableHeaders = headers(rows[0]).map(ascii);
  const columnWidths = [78, 92, 74, 105, 30, 112, 98, 68, 60, 77];
  const fontSize = 6.7;
  const lineHeight = 8;
  const headerHeight = 29;
  const pageContents: string[][] = [];
  let commands: string[] = [];
  let y = 0;

  const cellLines = (value: string, width: number) => {
    const normalized = ascii(value) || '—';
    const maxChars = Math.max(3, Math.floor((width - 8) / (fontSize * 0.52)));
    const words = normalized.split(/\s+/).flatMap(word => {
      if (word.length <= maxChars) return [word];
      return Array.from({ length: Math.ceil(word.length / maxChars) }, (_, index) => word.slice(index * maxChars, (index + 1) * maxChars));
    });
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = `${current} ${word}`.trim();
      if (candidate.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : ['—'];
  };

  const drawCells = (lines: string[][], top: number, height: number, header: boolean, shaded = false) => {
    if (header) commands.push(`q 0.122 0.365 0.561 rg ${margin} ${top - height} ${pageWidth - margin * 2} ${height} re f Q`);
    else if (shaded) commands.push(`q 0.965 0.976 0.988 rg ${margin} ${top - height} ${pageWidth - margin * 2} ${height} re f Q`);
    let x = margin;
    lines.forEach((cell, columnIndex) => {
      const width = columnWidths[columnIndex];
      commands.push(`q 0.70 0.76 0.81 RG 0.5 w ${x} ${top - height} ${width} ${height} re S Q`);
      cell.forEach((line, lineIndex) => {
        commands.push(`BT /${header ? 'F2' : 'F1'} ${header ? 7 : fontSize} Tf ${header ? '1 1 1' : '0.12 0.16 0.21'} rg ${x + 4} ${top - 11 - lineIndex * lineHeight} Td (${escape(line)}) Tj ET`);
      });
      x += width;
    });
  };

  const startPage = () => {
    commands = [];
    const continuation = pageContents.length ? ' (devam)' : '';
    commands.push(`q 0.063 0.165 0.263 rg ${margin} ${pageHeight - 56} ${pageWidth - margin * 2} 34 re f Q`);
    commands.push(`BT /F2 15 Tf 1 1 1 rg ${margin + 12} ${pageHeight - 35} Td (TALEPLER RAPORU${continuation}) Tj ET`);
    commands.push(`BT /F1 8 Tf 0.32 0.41 0.48 rg ${margin} ${pageHeight - 70} Td (Olusturulma: ${escape(date(new Date()))}) Tj ET`);
    const headerLines = tableHeaders.map((value, index) => cellLines(value, columnWidths[index]));
    y = pageHeight - 82;
    drawCells(headerLines, y, headerHeight, true);
    y -= headerHeight;
  };
  const finishPage = () => {
    pageContents.push(commands);
  };

  startPage();
  rows.forEach((item, rowIndex) => {
    const lines = values(item).map((value, index) => cellLines(value, columnWidths[index]));
    const maxLines = Math.max(...lines.map(cell => cell.length));
    let lineOffset = 0;
    while (lineOffset < maxLines) {
      const availableLines = Math.floor((y - margin - 8) / lineHeight);
      if (availableLines < 1) {
        finishPage();
        startPage();
        continue;
      }
      const segmentLineCount = Math.min(maxLines - lineOffset, availableLines);
      const segment = lines.map(cell => cell.slice(lineOffset, lineOffset + segmentLineCount));
      const rowHeight = 8 + segmentLineCount * lineHeight;
      drawCells(segment, y, rowHeight, false, rowIndex % 2 === 1);
      y -= rowHeight;
      lineOffset += segmentLineCount;
      if (lineOffset < maxLines) {
        finishPage();
        startPage();
      }
    }
  });
  finishPage();
  pageContents.forEach((page, index) => {
    page.push(`BT /F1 7 Tf 0.32 0.41 0.48 rg ${pageWidth - margin - 48} 12 Td (Sayfa ${index + 1}/${pageContents.length}) Tj ET`);
  });

  const objects: string[] = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${pageContents.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${pageContents.length} >>`];
  pageContents.forEach((page, i) => {
    const pageId = 3 + i * 2;
    const contentId = pageId + 1;
    const content = page.join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`);
  });
  let output = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(output, 'utf8')); output += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(output, 'utf8');
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, 'utf8');
}