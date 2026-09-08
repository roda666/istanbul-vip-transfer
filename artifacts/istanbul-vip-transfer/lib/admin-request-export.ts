export interface RequestExportRow {
  referenceNumber: string;
  name: string;
  phone: string;
  normalizedEmail: string | null;
  locale: string;
  source: string;
  serviceType: string;
  intent: string;
  status: string;
  createdAt: Date | string;
  requestData?: unknown;
  adminNotes?: string | null;
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
const FIELD_LABELS: Record<string, string> = {
  tarih: 'Tarih', saatSaat: 'Saat', saatDakika: 'Dakika', yolcuSayisi: 'Yolcu Sayısı',
  adSoyad: 'Ad Soyad', telefon: 'Telefon', email: 'E-posta', alisLokasyonu: 'Alış Lokasyonu',
  alisAdresi: 'Alış Adresi', varisLokasyonu: 'Varış Lokasyonu', varisAdresi: 'Varış Adresi',
  ucusNumarasi: 'Uçuş Numarası', bagajSayisi: 'Bagaj Sayısı', seyahatYonu: 'Yön',
  kalkisIli: 'Kalkış İli', kalkisAdres: 'Kalkış Adresi', varisIli: 'Varış İli',
  tahsisSuresi: 'Tahsis Süresi', tahsisSuresiUnit: 'Süre Birimi', rotaAciklama: 'Rota Açıklaması',
  talepsRota: 'Tur Rotası', talepsYerler: 'Ziyaret Yerleri', planlananSure: 'Planlanan Süre',
  planlananSureUnit: 'Süre Birimi', vehiclePreference: 'Araç Tercihi',
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

function detailValues(row: RequestExportRow): Array<[string, string]> {
  const base: Array<[string, string]> = [
    ['Referans', row.referenceNumber],
    ['Ad Soyad', row.name],
    ['Telefon', row.phone],
    ['E-posta', row.normalizedEmail || '—'],
    ['Dil', row.locale.toUpperCase()],
    ['Kaynak', SOURCE_LABELS[row.source] ?? row.source],
    ['Hizmet', SERVICE_LABELS[row.serviceType] ?? row.serviceType],
    ['Talep Türü', INTENT_LABELS[row.intent] ?? row.intent],
    ['Durum', STATUS_LABELS[row.status] ?? row.status],
    ['Kayıt Tarihi', date(row.createdAt)],
  ];
  const formData = row.requestData && typeof row.requestData === 'object' && !Array.isArray(row.requestData)
    ? row.requestData as Record<string, unknown> : {};
  const dynamic = Object.entries(formData)
    .filter(([key, value]) => value !== null && value !== '' && value !== undefined
      && !['_hp', 'emailNotification', 'vehiclePreferenceId'].includes(key))
    .map(([key, value]) => [FIELD_LABELS[key] ?? key, text(value)] as [string, string]);
  if (row.adminNotes) dynamic.push(['Yönetici Notları', row.adminNotes]);
  return [...base, ...dynamic];
}

export function requestExportFileName(extension: 'xls' | 'pdf') {
  return `talepler-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

/** SpreadsheetML opens natively in Excel without requiring a server-side binary dependency. */
export function requestsToExcel(rows: RequestExportRow[], detailed = rows.length === 1) {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const row = (cells: string[], header = false) => `<Row>${cells.map(cell => `<Cell${header ? ' ss:StyleID="Header"' : ''}><Data ss:Type="String">${escape(cell)}</Data></Cell>`).join('')}</Row>`;
  const tableRows = detailed && rows[0]
    ? detailValues(rows[0]).map(([label, value]) => row([label, value], label === 'Referans')).join('')
    : `${row(headers, true)}${rows.map(item => row(values(item))).join('')}`;
  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="Header"><Font ss:Bold="1"/></Style></Styles><Worksheet ss:Name="Talepler"><Table>${tableRows}</Table></Worksheet></Workbook>`;
}

/** A deliberately small, dependency-free PDF table. Turkish glyphs are transliterated for core PDF fonts. */
export function requestsToPdf(rows: RequestExportRow[], detailed = rows.length === 1) {
  const ascii = (value: string) => text(value).replace(/İ/g, 'I').replace(/ı/g, 'i').replace(/Ş/g, 'S').replace(/ş/g, 's').replace(/Ğ/g, 'G').replace(/ğ/g, 'g').replace(/Ü/g, 'U').replace(/ü/g, 'u').replace(/Ö/g, 'O').replace(/ö/g, 'o').replace(/Ç/g, 'C').replace(/ç/g, 'c');
  const escape = (value: string) => ascii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const lines = detailed && rows[0] ? [
    `Talep Detayi - ${rows[0].referenceNumber}`,
    `Olusturulma: ${date(new Date())}`,
    '',
    ...detailValues(rows[0]).map(([label, value]) => `${label}: ${value}`),
  ] : [
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