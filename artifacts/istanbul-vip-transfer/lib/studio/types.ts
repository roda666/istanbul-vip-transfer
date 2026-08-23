/**
 * AI İçerik Stüdyosu — shared TypeScript types
 * Used by API routes, lib helpers, and client components.
 */

// ── Stage / Status enums ───────────────────────────────────────────────────────

export type StudioStage =
  | 'setup'
  | 'research'
  | 'brief'
  | 'draft'
  | 'seo_check'
  | 'visual'
  | 'translations'
  | 'review'
  | 'approval'
  | 'scheduling'
  | 'published'
  | 'archived';

export type StudioStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'archived';

export type TranslationLangStatus =
  | 'pending'
  | 'generating'
  | 'draft'
  | 'approved'
  | 'published';

export type ImageStatus =
  | 'generating'
  | 'pending_approval'
  | 'approved'
  | 'rejected';

export type DistributionPlatform =
  | 'newsletter'
  | 'instagram'
  | 'facebook'
  | 'twitter'
  | 'linkedin'
  | 'google_business';

// ── Target languages (TR is source, these are the 8 targets) ─────────────────

export const TARGET_LANGS = ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'] as const;
export type TargetLang = (typeof TARGET_LANGS)[number];

export const LANG_LABELS: Record<string, string> = {
  en: 'İngilizce',
  de: 'Almanca',
  ru: 'Rusça',
  ar: 'Arapça',
  fr: 'Fransızca',
  es: 'İspanyolca',
  it: 'İtalyanca',
  nl: 'Felemenkçe',
};

// ── Project config (set at creation, editable until draft) ────────────────────

export interface StudioConfig {
  contentType?: 'blog' | 'service';
  serviceType?: string;         // 'airport_transfer' | 'intercity' | 'vip_tour' | 'corporate'
  searchIntent?: string;        // 'informational' | 'commercial' | 'navigational' | 'transactional'
  cityOrRoute?: string;
  audience?: string;
  keywords?: string[];          // manually entered — labeled "manuel anahtar kelime"
  publishDate?: string;         // ISO date
  tone?: string;                // 'Profesyonel' | 'Samimi' | etc.
  wordCountTarget?: number;
  articleType?: string;         // 'Rehber' | 'Liste' | 'SSS' | etc.
  targetService?: string;       // for service page type
  notes?: string;
  [key: string]: unknown;       // allow extra fields from DB jsonb
}

// ── Content payload (same structure for TR and each translation) ──────────────

export interface StudioContent {
  title: string;
  slug: string;
  excerpt: string;
  bodyMd: string;              // Markdown body
  faqs: Array<{ question: string; answer: string }>;
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImageAlt?: string;
  internalLinks: Array<{ anchor: string; url: string; reason: string }>;
  structuredDataType?: 'Article' | 'FAQPage' | 'LocalBusiness' | 'Service';
  wordCount: number;
  timeSensitive: boolean;
}

// ── SEO quality score ─────────────────────────────────────────────────────────

export interface SeoScore {
  overallScore: number;        // 0-100
  intentAlignment: number;
  titleHierarchy: number;
  readability: number;
  metaLengths: number;
  sourcesCoverage: number;
  forbiddenClaims: { found: boolean; examples: string[] };
  suggestions: string[];
}

// ── Research source ───────────────────────────────────────────────────────────

export interface ResearchSource {
  id: string;
  projectId: string;
  url: string | null;
  title: string | null;
  accessedAt: string | null;
  claims: string[];
  sourceType: string;
}

// ── Translation record ────────────────────────────────────────────────────────

export interface StudioTranslation {
  id: string;
  projectId: string;
  lang: string;
  content: StudioContent | null;
  status: TranslationLangStatus;
  approvedAt: string | null;
  approvedBy: string | null;
  publishedAt: string | null;
  aiModel: string | null;
  aiTokens: number;
  createdAt: string;
  updatedAt: string;
}

// ── Studio image ──────────────────────────────────────────────────────────────

export interface StudioImage {
  id: string;
  projectId: string;
  objectPath: string | null;
  url: string | null;
  prompt: string | null;
  altText: string | null;
  usageRights: string;
  status: ImageStatus;
  rejectionReason: string | null;
  approvedAt: string | null;
  createdAt: string;
}

// ── Distribution draft ────────────────────────────────────────────────────────

export interface DistributionDraft {
  id: string;
  projectId: string;
  platform: DistributionPlatform;
  content: string;
  status: string;
  remoteId?: string | null;
  remoteUrl?: string | null;
  lastError?: string | null;
  retryCount?: number;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

// ── Audit log entry ───────────────────────────────────────────────────────────

export interface StudioAuditEntry {
  id: string;
  projectId: string;
  adminId: string | null;
  action: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

// ── Schedule ──────────────────────────────────────────────────────────────────

export interface StudioSchedule {
  id: string;
  projectId: string;
  scheduledFor: string;
  langs: string[];
  idempotencyKey: string;
  status: 'pending' | 'executed' | 'cancelled' | 'error';
  executedAt: string | null;
  error: string | null;
}

// ── Full project record ───────────────────────────────────────────────────────

export interface StudioProject {
  id: string;
  contentType: 'blog' | 'service';
  stage: StudioStage;
  status: StudioStatus;
  titleWorking: string | null;
  config: StudioConfig;
  trContent: StudioContent | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  trApprovedAt: string | null;
  trApprovedBy: string | null;
  seoScore: SeoScore | null;
  cannibalization: { hasConflict: boolean; conflictingPages: Array<{ slug: string; title: string }> } | null;
  cmsEntityId: string | null;
  cmsEntityType: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined
  translations?: StudioTranslation[];
  images?: StudioImage[];
  research?: ResearchSource[];
  distribution?: DistributionDraft[];
  schedule?: StudioSchedule | null;
  recentAudit?: StudioAuditEntry[];
}

// ── API result wrapper ────────────────────────────────────────────────────────

export type AIResult<T> =
  | { ok: true; data: T; model: string; tokens?: number }
  | { ok: false; reason: 'not_configured' | 'credit_exhausted' | 'rate_limited' | 'api_error' | 'parse_error' | 'truncated'; message: string };

// ── Stage ordering ────────────────────────────────────────────────────────────

export const STAGE_ORDER: StudioStage[] = [
  'setup', 'research', 'brief', 'draft', 'seo_check',
  'visual', 'translations', 'review', 'approval', 'scheduling', 'published', 'archived',
];

export const STAGE_LABELS: Record<StudioStage, string> = {
  setup:        'Kurulum',
  research:     'Araştırma',
  brief:        'İçerik Özeti',
  draft:        'Türkçe Taslak',
  seo_check:    'SEO & Doğruluk',
  visual:       'Görsel',
  translations: 'Çeviriler',
  review:       'İnceleme',
  approval:     'Onay',
  scheduling:   'Zamanlama',
  published:    'Yayınlandı',
  archived:     'Arşivlendi',
};

export const STATUS_LABELS: Record<StudioStatus, string> = {
  draft:     'Taslak',
  in_review: 'İncelemede',
  approved:  'Onaylı',
  scheduled: 'Planlandı',
  published: 'Yayınlandı',
  archived:  'Arşivlendi',
};

export const TRANS_STATUS_LABELS: Record<TranslationLangStatus, string> = {
  pending:    'Bekliyor',
  generating: 'Üretiliyor',
  draft:      'Taslak',
  approved:   'Onaylı',
  published:  'Yayınlandı',
};
