export interface RequestPresentationInput {
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

export interface RequestPresentationField {
  key: string;
  label: string;
  value: string;
}

export interface RequestPresentationSection {
  key: 'contact' | 'request' | 'journey' | 'notes';
  title: string;
  fields: RequestPresentationField[];
}

export interface RequestListPresentation {
  headers: string[];
  values: string[];
}

const SERVICE_LABELS: Record<string, string> = {
  AIRPORT_TRANSFER: 'Havalimanı / Şehir İçi Transfer',
  INTERCITY: 'Şehirler Arası Transfer',
  ALLOCATION: 'Araç Tahsisi',
  TOUR: 'Özel Tur / Gezi',
  CONTACT_INQUIRY: 'İletişim Talebi',
};

const INTENT_LABELS: Record<string, string> = {
  QUOTE: 'Fiyat Teklifi',
  RESERVATION: 'Rezervasyon',
};

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Yeni',
  CONTACTED: 'İletişimde',
  QUOTED: 'Teklife Gönderildi',
  CONFIRMED: 'Onaylandı',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
  SPAM: 'Spam',
  ARCHIVED: 'Arşivlendi',
};

const SOURCE_LABELS: Record<string, string> = {
  'contact-form': 'İletişim Formu',
  'booking-form': 'Rezervasyon Formu',
  website: 'Web Sitesi',
};

const SOURCE_SERVICE_LABELS: Record<string, string> = {
  AIRPORT_TRANSFER: 'Havalimanı Transferi',
  INTERCITY: 'Şehirler Arası Transfer',
  ALLOCATION: 'Araç Tahsisi',
  TOUR: 'Özel Tur / Gezi',
  CONTACT_INQUIRY: 'İletişim Talebi',
};

const VALUE_LABELS: Record<string, string> = {
  GIDIS: 'Tek Yön',
  GIDIS_DONUS: 'Gidiş-Dönüş',
  SAAT: 'Saat',
  GUN: 'Gün',
  sent: 'Gönderildi',
  started: 'İşlem Başlatıldı',
  partial: 'Kısmen Gönderildi',
  failed: 'Başarısız',
  pending: 'Bekliyor',
  skipped: 'Atlandı',
  'not-configured': 'Yapılandırılmamış',
};

const JOURNEY_FIELDS: Array<[string, string]> = [
  ['tarih', 'Tarih'],
  ['alisLokasyonu', 'Alış Lokasyonu'],
  ['alisAdresi', 'Alış Adresi'],
  ['varisLokasyonu', 'Varış Lokasyonu'],
  ['varisAdresi', 'Varış Adresi'],
  ['kalkisIli', 'Kalkış İli'],
  ['kalkisAdres', 'Kalkış Adresi'],
  ['varisIli', 'Varış İli'],
  ['varisAdres', 'Varış Adresi'],
  ['yolcuSayisi', 'Yolcu Sayısı'],
  ['bagajSayisi', 'Bagaj Sayısı'],
  ['ucusNumarasi', 'Uçuş Numarası'],
  ['seyahatYonu', 'Yön'],
  ['rotaAciklama', 'Rota Açıklaması'],
  ['talepsRota', 'Tur Rotası'],
  ['talepsYerler', 'Ziyaret Yerleri'],
  ['vehiclePreference', 'Araç Tercihi'],
  ['childSeatCount', 'Çocuk Koltuğu'],
  ['additionalNotes', 'Ek Notlar'],
];

function clean(value: unknown): string {
  if (typeof value === 'string') return value.replace(/[\u0000-\u001F]/g, ' ').trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function labelled(value: unknown): string {
  const normalized = clean(value);
  return VALUE_LABELS[normalized] ?? normalized;
}

function formatSource(source: string): string {
  const [sourceKey, embeddedServiceType] = source.split(':', 2);
  const sourceLabel = SOURCE_LABELS[sourceKey] ?? 'Diğer Kaynak';
  const embeddedServiceLabel = embeddedServiceType ? SOURCE_SERVICE_LABELS[embeddedServiceType] : '';
  return embeddedServiceLabel ? `${sourceLabel} – ${embeddedServiceLabel}` : sourceLabel;
}

function formatService(serviceType: string): string {
  return SERVICE_LABELS[serviceType] ?? 'Diğer Hizmet';
}

function formatIntent(intent: string): string {
  return INTENT_LABELS[intent] ?? 'Diğer';
}

function formatStatus(status: string): string {
  return STATUS_LABELS[status] ?? 'Bilinmiyor';
}

function displayJourneyValue(key: string, value: unknown): unknown {
  const normalized = clean(value);
  if (key === 'tarih' && /^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split('-');
    return `${day}.${month}.${year}`;
  }
  return value;
}

function field(key: string, label: string, value: unknown): RequestPresentationField | null {
  const formatted = labelled(value);
  return formatted ? { key, label, value: formatted } : null;
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function communicationFields(data: Record<string, unknown>): RequestPresentationField[] {
  const fields: Array<RequestPresentationField | null> = [];
  const communication = object(data.communication);
  const legacyEmail = object(data.emailNotification);

  if (communication) {
    const newsletter = object(communication.newsletterOptIn);
    const admin = object(communication.adminNotification);
    const customer = object(communication.customerConfirmation);
    fields.push(
      field('newsletter-status', 'Bülten İzni', newsletter?.status),
      field(
        'admin-notification',
        'Yönetici Bildirimi',
        admin?.status
          ? `${labelled(admin.status)}${typeof admin.acceptedCount === 'number' && typeof admin.recipientCount === 'number' ? ` (${admin.acceptedCount}/${admin.recipientCount})` : ''}`
          : '',
      ),
      field(
        'customer-confirmation',
        'Müşteri Onayı',
        customer?.status
          ? `${labelled(customer.status)}${typeof customer.acceptedCount === 'number' ? ` (${customer.acceptedCount} kabul)` : ''}`
          : '',
      ),
    );
  } else if (legacyEmail) {
    fields.push(field('email-notification', 'E-posta Bildirimi', legacyEmail.status));
  }

  return fields.filter((item): item is RequestPresentationField => item !== null);
}

function journeyFields(data: Record<string, unknown>): RequestPresentationField[] {
  const fields: Array<RequestPresentationField | null> = [];
  const hour = clean(data.saatSaat);
  const minute = clean(data.saatDakika);

  for (const [key, label] of JOURNEY_FIELDS) {
    fields.push(field(key, label, displayJourneyValue(key, data[key])));
    if (key === 'tarih' && (hour || minute)) {
      fields.push(field('saat', 'Saat', `${hour || '00'}:${minute || '00'}`));
    }
  }

  const allocation = clean(data.tahsisSuresi);
  if (allocation) fields.push(field('tahsisSuresi', 'Tahsis Süresi', `${allocation} ${labelled(data.tahsisSuresiUnit)}`));
  const planned = clean(data.planlananSure);
  if (planned) fields.push(field('planlananSure', 'Planlanan Süre', `${planned} ${labelled(data.planlananSureUnit)}`));

  if (Array.isArray(data.customFields)) {
    data.customFields.forEach((item, index) => {
      const custom = object(item);
      const label = clean(custom?.label);
      const value = custom?.value === true ? 'Evet' : clean(custom?.value);
      if (label && value) fields.push(field(`custom-${index}`, label, value));
    });
  }

  return fields.filter((item): item is RequestPresentationField => item !== null);
}

export function buildRequestPresentation(input: RequestPresentationInput): RequestPresentationSection[] {
  const data = object(input.requestData) ?? {};
  const sections: RequestPresentationSection[] = [
    {
      key: 'contact',
      title: 'İletişim Bilgileri',
      fields: [
        field('name', 'Ad Soyad', input.name),
        field('phone', 'Telefon', input.phone),
        field('email', 'E-posta', input.normalizedEmail || '—'),
        field('locale', 'Dil', input.locale.toUpperCase()),
        field('source', 'Kaynak', formatSource(input.source)),
        ...communicationFields(data),
      ].filter((item): item is RequestPresentationField => item !== null),
    },
    {
      key: 'request',
      title: 'Talep-Hizmet Bilgileri',
      fields: [
        field('reference', 'Referans', input.referenceNumber),
        field('service', 'Hizmet', formatService(input.serviceType)),
        field('intent', 'Talep Türü', formatIntent(input.intent)),
        field('status', 'Durum', formatStatus(input.status)),
        field('createdAt', 'Kayıt Tarihi', formatDate(input.createdAt)),
      ].filter((item): item is RequestPresentationField => item !== null),
    },
    {
      key: 'journey',
      title: 'Yolculuk Detayları',
      fields: journeyFields(data),
    },
  ];

  if (input.adminNotes?.trim()) {
    sections.push({
      key: 'notes',
      title: 'Yönetici Notları',
      fields: [{ key: 'adminNotes', label: 'Not', value: clean(input.adminNotes) }],
    });
  }

  return sections;
}

const LIST_FIELD_KEYS = ['reference', 'name', 'phone', 'email', 'locale', 'source', 'service', 'intent', 'status', 'createdAt'];
const LIST_HEADERS = ['Referans', 'İsim', 'Telefon', 'E-posta', 'Dil', 'Kaynak', 'Hizmet', 'Talep', 'Durum', 'Kayıt Tarihi'];

export function buildRequestListPresentation(input: RequestPresentationInput): RequestListPresentation {
  const fields = new Map(
    buildRequestPresentation(input)
      .flatMap(section => section.fields)
      .map(item => [item.key, item.value]),
  );
  return {
    headers: LIST_HEADERS,
    values: LIST_FIELD_KEYS.map(key => fields.get(key) || '—'),
  };
}
