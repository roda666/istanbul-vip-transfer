/**
 * Drizzle ORM schema — all database tables for the admin panel.
 */
import {
  pgTable,
  pgEnum,
  text,
  boolean,
  integer,
  serial,
  timestamp,
  uuid,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

// ── Enums ───────────────────────────────────────────────────────────────────

export const adminRoleEnum = pgEnum('admin_role', [
  'SUPER_ADMIN',
  'ADMIN',
  'EDITOR',
  'CHAT_STAFF',
]);

export const contentTypeEnum = pgEnum('content_type', [
  'PAGE',
  'SERVICE',
  'BLOG_POST',
]);

export const contentStatusEnum = pgEnum('content_status', [
  'IDEA',
  'DRAFT',
  'RESEARCH',
  'REVIEW',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'OUTDATED',
  'ARCHIVED',
]);

export const navLocationEnum = pgEnum('nav_location', [
  'HEADER',
  'FOOTER',
  'MOBILE',
]);

export const aiSuggestionStatusEnum = pgEnum('ai_suggestion_status', [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETE',
  'REJECTED',
]);

export const locationTypeEnum = pgEnum('location_type', [
  'AIRPORT',
  'DISTRICT',
  'REGION',
  'HOTEL_ZONE',
  'CUSTOM',
  'PROVINCE',
]);

/** LOCAL = only in local (Istanbul) transfer form, INTERCITY = only in intercity form, BOTH = appears in both. */
export const locationScopeEnum = pgEnum('location_scope', ['LOCAL', 'INTERCITY', 'BOTH']);

/** Status lifecycle for translation jobs. */
export const translationStatusEnum = pgEnum('translation_status', [
  'NOT_STARTED',
  'QUEUED',
  'TRANSLATING',
  'DRAFT',
  'REVIEW',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'FAILED',
  'OUTDATED',
  'ARCHIVED',
]);

/** Text direction for languages. */
export const textDirectionEnum = pgEnum('text_direction', ['ltr', 'rtl']);

// ── Tables ──────────────────────────────────────────────────────────────────

export const adminUsers = pgTable('admin_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: adminRoleEnum('role').default('ADMIN').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  sessionVersion: integer('session_version').default(1).notNull(),
});

export const content = pgTable('content', {
  id: uuid('id').primaryKey().defaultRandom(),
  contentType: contentTypeEnum('content_type').notNull(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  excerpt: text('excerpt'),
  body: text('body'),
  heroImage: text('hero_image'),
  heroImageAlt: text('hero_image_alt'),
  ogImage: text('og_image'),
  status: contentStatusEnum('status').default('DRAFT').notNull(),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  canonicalUrl: text('canonical_url'),
  indexable: boolean('indexable').default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  /** Service category slug — must match a slug in service_categories table (airport|city_vip|intercity|tour|special) */
  category: text('category'),
  /** Whether to show this service on the public homepage service cards grid. */
  showOnHomepage: boolean('show_on_homepage').default(true).notNull(),
  /** Whether to show this service in the site navigation (header/footer/mobile menu). */
  showInNav: boolean('show_in_nav').default(true).notNull(),
  /**
   * Pending draft body for a PUBLISHED service page.
   * When an admin saves changes without publishing, the live `body` is preserved
   * and edits are stored here. On "Kaydet ve Yayımla", this is promoted to `body`
   * and cleared. NULL when no unpublished changes are pending.
   */
  draftBody: text('draft_body'),
  /** Blog-specific fields — NULL for SERVICE/PAGE content types */
  author: text('author'),
  tags: jsonb('tags').$type<string[]>(),
  readTimeMinutes: integer('read_time_minutes'),
  internalLinks: jsonb('internal_links').$type<Array<{ label: string; href: string; anchor?: string }>>(),
  cta: jsonb('cta').$type<{ text: string; url: string } | null>(),
  ogTitle: text('og_title'),
  ogDescription: text('og_description'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: uuid('approved_by').references(() => adminUsers.id),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const faqs = pgTable('faqs', {
  id: uuid('id').primaryKey().defaultRandom(),
  contentId: uuid('content_id')
    .notNull()
    .references(() => content.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});

/** Revision snapshots for BLOG_POST content. Last 20 revisions shown in admin. */
export const blogRevisions = pgTable('blog_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  contentId: uuid('content_id').notNull().references(() => content.id, { onDelete: 'cascade' }),
  snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
  changedBy: uuid('changed_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Singleton settings row — always upsert with id = 1. */
export const siteSettings = pgTable('site_settings', {
  id: integer('id').primaryKey().default(1),
  businessName: text('business_name'),
  logoPath: text('logo_path'),
  phoneDisplay: text('phone_display'),
  phoneInternational: text('phone_international'),
  whatsappNumber: text('whatsapp_number'),
  email: text('email'),
  googleBusinessUrl: text('google_business_url'),
  address: text('address'),
  defaultSeoTitle: text('default_seo_title'),
  defaultSeoDescription: text('default_seo_description'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  // Reservation form settings
  timeStepMinutes: integer('time_step_minutes').default(5).notNull(),
  exactAddressRequired: boolean('exact_address_required').default(false).notNull(),
  locationSearchEnabled: boolean('location_search_enabled').default(true).notNull(),
  // Optional booking form fields (admin toggles each on/off; default off = current slim form)
  showLuggageCount: boolean('show_luggage_count').default(false).notNull(),
  showChildSeatCount: boolean('show_child_seat_count').default(false).notNull(),
  showVehiclePreference: boolean('show_vehicle_preference').default(false).notNull(),
  showAdditionalNotes: boolean('show_additional_notes').default(false).notNull(),
  // Legal / trust fields (shown in footer and legal pages)
  companyLegalName: text('company_legal_name'),  // e.g. "Hevra Turizm"
  companyTradeName: text('company_trade_name'),  // e.g. "The History Travel"
  tursabNo:         text('tursab_no'),           // e.g. "A-7377"
  fullAddress:      text('full_address'),         // Full registered address
  googlePlayUrl:    text('google_play_url'),      // Mobile app link (optional)
  googleReviewUrl:  text('google_review_url'),    // Direct Google review link
});

export const navigationItems = pgTable('navigation_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  label: text('label').notNull(),
  href: text('href').notNull(),
  location: navLocationEnum('location').default('HEADER').notNull(),
  parentId: uuid('parent_id').references((): AnyPgColumn => navigationItems.id),
  sortOrder: integer('sort_order').default(0).notNull(),
  active: boolean('active').default(true).notNull(),
});

export const topicClusters = pgTable('topic_clusters', {
  id:               uuid('id').primaryKey().defaultRandom(),
  pillarSlug:       text('pillar_slug').notNull(),
  pillarTitle:      text('pillar_title').notNull(),
  /** Array of {id, slug, title, publishedAt?, suggestionId?} */
  clusterArticles:  jsonb('cluster_articles').$type<Array<{
    id: string; slug: string; title: string;
    publishedAt?: string | null; suggestionId?: string | null;
  }>>().default([]).notNull(),
  /** Suggested internal link anchors for cluster articles */
  suggestedLinks:   jsonb('suggested_links').$type<Array<{ from: string; to: string; anchor: string }>>().default([]).notNull(),
  createdBy:        uuid('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  createdAt:        timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Rakip siteler listesi — ileride rakip bazlı içerik boşluğu analizinde kullanılır.
 * Her satır bir rakip domaini temsil eder.
 */
export const competitorSites = pgTable('competitor_sites', {
  id:        serial('id').primaryKey(),
  domain:    text('domain').notNull().unique(),   // e.g. "cabistanbul.com"
  label:     text('label').notNull(),             // display name, e.g. "Cab Istanbul"
  notes:     text('notes'),                       // optional analysis notes
  active:    boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const aiContentSuggestions = pgTable('ai_content_suggestions', {
  id: uuid('id').primaryKey().defaultRandom(),
  suggestedTitle:       text('suggested_title'),
  suggestedSlug:        text('suggested_slug'),
  primaryKeyword:       text('primary_keyword'),
  secondaryKeywords:    text('secondary_keywords'),
  /** Structured keyword data from AI: { keywords: [{term, intent}] } */
  suggestedKeywordsJson: jsonb('suggested_keywords_json').$type<{
    keywords: Array<{ term: string; intent: string; isPrimary: boolean }>;
    dataSourceNote: string;
  }>(),
  searchIntent:         text('search_intent'),
  suggestedOutline:     text('suggested_outline'),
  /** AI-generated article summary (before full draft) */
  aiSummary:            text('ai_summary'),
  /** Full generated article draft (Markdown/HTML) */
  contentDraft:         text('content_draft'),
  /** Error details if generation failed */
  draftError:           text('draft_error'),
  targetService:        text('target_service'),
  targetLocation:       text('target_location'),
  articleType:          text('article_type'),
  /** Customer profile, e.g. "business travelers, families with children" */
  customerProfile:      text('customer_profile'),
  /** Target country for geo-tailored SEO */
  targetCountry:        text('target_country'),
  /** Language for the content (defaults to tr) */
  targetLanguage:       text('target_language').default('tr').notNull(),
  /** Content brief: { tone, wordCountTarget, competitorContext } */
  contentBrief:         jsonb('content_brief').$type<{
    tone: string;
    wordCountTarget: number;
    competitorContext?: string;
  }>(),
  /** Quality score results from the quality analysis pass */
  qualityScore:         jsonb('quality_score').$type<{
    intentAlignment: number;
    uniqueness: number;
    titleHierarchy: number;
    readability: number;
    metaLengths: number;
    altTextPresent: boolean;
    internalLinkCount: number;
    sourcesCoverage: number;
    forbiddenClaims: { found: boolean; examples: string[] };
    overallScore: number;
  }>(),
  /** Cannibalization check result */
  cannibalWarning:      jsonb('cannibalization_warning').$type<{
    hasConflict: boolean;
    conflictingPages: Array<{ slug: string; title: string; url: string; updatedAt?: string }>;
  }>(),
  /** Topic cluster this article belongs to */
  topicClusterId:       uuid('topic_cluster_id').references(() => topicClusters.id, { onDelete: 'set null' }),
  /** Blog post created from this suggestion */
  draftBlogPostId:      uuid('draft_blog_post_id').references(() => content.id, { onDelete: 'set null' }),
  /** Whether content contains time-sensitive claims (needs periodic review) */
  timeSensitive:        boolean('time_sensitive').default(false).notNull(),
  lastReviewedAt:       timestamp('last_reviewed_at', { withTimezone: true }),
  suggestedPublishDate: timestamp('suggested_publish_date', { withTimezone: true }),
  status: aiSuggestionStatusEnum('status').default('PENDING').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const researchSources = pgTable('research_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  suggestionId: uuid('suggestion_id')
    .references(() => aiContentSuggestions.id, { onDelete: 'cascade' }),
  /** Optional link to a blog post if this source was used during article generation */
  contentId:    uuid('content_id').references(() => content.id, { onDelete: 'cascade' }),
  title:        text('title'),
  url:          text('url'),
  sourceName:   text('source_name'),
  accessedAt:   timestamp('accessed_at', { withTimezone: true }),
  /** The specific claim or section this source supports */
  claimSupported: text('claim_supported'),
  /** 'web' | 'manual' | 'ai_context' */
  sourceType:   text('source_type').default('manual').notNull(),
  notes:        text('notes'),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminUserId: uuid('admin_user_id').references(() => adminUsers.id, {
    onDelete: 'set null',
  }),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb('metadata'),
});

export const vehicles = pgTable('vehicles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  shortDescription: text('short_description'),
  fullDescription: text('full_description'),
  passengerCapacity: integer('passenger_capacity'),
  luggageCapacity: integer('luggage_capacity'),
  vehicleType: text('vehicle_type'),
  features: jsonb('features').$type<string[]>().default([]).notNull(),
  coverImage: text('cover_image'),
  coverImageAlt: text('cover_image_alt'),
  gallery: jsonb('gallery').$type<Array<{ url: string; alt: string }>>().default([]).notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  isFeatured: boolean('is_featured').default(false).notNull(),
  status: contentStatusEnum('status').default('DRAFT').notNull(),
  /** JSONB i18n: {"tr":"…","en":"…","de":"…","ru":"…","ar":"…","fr":"…","es":"…","it":"…","nl":"…"} */
  nameTranslations:      jsonb('name_translations').$type<Record<string, string>>(),
  shortDescTranslations: jsonb('short_desc_translations').$type<Record<string, string>>(),
  taglineTranslations:   jsonb('tagline_translations').$type<Record<string, string>>(),
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  canonicalUrl: text('canonical_url'),
  ogImage: text('og_image'),
  robotsIndex: boolean('robots_index').default(true).notNull(),
  robotsFollow: boolean('robots_follow').default(true).notNull(),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: uuid('approved_by').references(() => adminUsers.id),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => adminUsers.id),
  updatedBy: uuid('updated_by').references(() => adminUsers.id),
});

export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  city: text('city').default('İstanbul').notNull(),
  district: text('district'),
  type: locationTypeEnum('type').default('DISTRICT').notNull(),
  /** LOCAL = only local transfer form; INTERCITY = only intercity form; BOTH = both forms. */
  scope: locationScopeEnum('scope').default('LOCAL').notNull(),
  pickupEnabled: boolean('pickup_enabled').default(true).notNull(),
  dropoffEnabled: boolean('dropoff_enabled').default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => adminUsers.id, { onDelete: 'set null' }),
});

/**
 * Service types for the booking form.
 * Seeded with 4 system types; admins can edit labels, descriptions, and toggles.
 */
export const serviceTypes = pgTable('service_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Stable system key — never changed by admins. e.g. AIRPORT_TRANSFER */
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  description: text('description'),
  enabled: boolean('enabled').default(true).notNull(),
  quoteEnabled: boolean('quote_enabled').default(true).notNull(),
  reservationEnabled: boolean('reservation_enabled').default(true).notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid('updated_by').references(() => adminUsers.id, { onDelete: 'set null' }),
});

/**
 * Languages available for translation.
 * Turkish (tr) is the default/source language and is always present.
 */
export const languages = pgTable('languages', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** ISO 639-1 code: 'en', 'de', 'ru', 'ar' */
  code: text('code').notNull().unique(),
  /** BCP 47 locale: 'en-GB', 'de-DE', 'ru-RU', 'ar-TR' */
  locale: text('locale').notNull(),
  /** English name: 'English', 'German' */
  name: text('name').notNull(),
  /** Native name: 'English', 'Deutsch', 'Русский', 'العربية' */
  nativeName: text('native_name').notNull(),
  direction: textDirectionEnum('direction').default('ltr').notNull(),
  /** Turkish display name shown in the admin UI: 'İngilizce', 'Almanca' */
  turkishName: text('turkish_name'),
  /** ISO 15924 writing system: 'Latn', 'Cyrl', 'Arab', ... */
  script: text('script').default('Latn').notNull(),
  /** Whether the AI translation provider (OpenAI) reliably supports this language. */
  providerSupported: boolean('provider_supported').default(true).notNull(),
  /** Whether the language is publicly visible (selector, sitemap, hreflang). */
  isPublished: boolean('is_published').default(false).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  isEnabled: boolean('is_enabled').default(true).notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => adminUsers.id, { onDelete: 'set null' }),
});

/**
 * Translation jobs for all translatable entities.
 * One row per (entityType, entityId, targetLanguageCode).
 */
export const contentTranslations = pgTable(
  'content_translations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** 'content', 'vehicle', 'faq', 'navigation' */
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    sourceLanguageCode: text('source_language_code').notNull().default('tr'),
    targetLanguageCode: text('target_language_code').notNull(),
    status: translationStatusEnum('status').default('NOT_STARTED').notNull(),

    // ── Translated fields ──────────────────────────────────────────────────
    title: text('title'),
    slug: text('slug'),
    excerpt: text('excerpt'),
    body: text('body'),
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    focusKeyword: text('focus_keyword'),
    supportingKeywords: jsonb('supporting_keywords').$type<string[]>(),
    imageAlt: text('image_alt'),
    imageTitle: text('image_title'),
    imageCaption: text('image_caption'),

    // ── Translation origin ─────────────────────────────────────────────────
    isAiGenerated: boolean('is_ai_generated').default(false).notNull(),
    aiModel: text('ai_model'),
    aiPromptVersion: text('ai_prompt_version'),

    // ── Workflow timestamps ────────────────────────────────────────────────
    queuedAt: timestamp('queued_at', { withTimezone: true }),
    translatingAt: timestamp('translating_at', { withTimezone: true }),
    draftAt: timestamp('draft_at', { withTimezone: true }),
    reviewAt: timestamp('review_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    failureReason: text('failure_reason'),

    // ── Approval ──────────────────────────────────────────────────────────
    approvedBy: uuid('approved_by').references(() => adminUsers.id, { onDelete: 'set null' }),

    // ── Homepage translation sync (migration 0007) ──────────────────────
    /** SHA-256 of TR translatable fields at time of last AI translation — used to skip re-translation when nothing changed. */
    sourceHash: text('source_hash'),
    /** When true, automatic sync must not overwrite this translation. */
    isManuallyLocked: boolean('is_manually_locked').notNull().default(false),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: uuid('locked_by').references(() => adminUsers.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  },
  (table) => [
    uniqueIndex('ct_entity_lang_unique').on(
      table.entityType,
      table.entityId,
      table.targetLanguageCode,
    ),
  ],
);

// ── Service Categories ────────────────────────────────────────────────────────
// DB-driven category taxonomy for the /hizmetler service listing.
// Admin manages categories via /admin/kategoriler.
export const serviceCategories = pgTable('service_categories', {
  id:               serial('id').primaryKey(),
  slug:             text('slug').unique().notNull(),
  nameTranslations: jsonb('name_translations').notNull().default({}),
  sortOrder:        integer('sort_order').notNull().default(0),
  isActive:         boolean('is_active').notNull().default(true),
  createdAt:        timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
export type ServiceCategory = typeof serviceCategories.$inferSelect;

// ── Inferred TypeScript types ────────────────────────────────────────────────

export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;
export type Content = typeof content.$inferSelect;
export type NewContent = typeof content.$inferInsert;
export type FAQ = typeof faqs.$inferSelect;
export type NewFAQ = typeof faqs.$inferInsert;
export type SiteSettings = typeof siteSettings.$inferSelect;
export type NavigationItem = typeof navigationItems.$inferSelect;
export type NewNavigationItem = typeof navigationItems.$inferInsert;
export type AIContentSuggestion = typeof aiContentSuggestions.$inferSelect;
export type NewAIContentSuggestion = typeof aiContentSuggestions.$inferInsert;
export type ResearchSource = typeof researchSources.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type NewVehicle = typeof vehicles.$inferInsert;
export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
export type ServiceType = typeof serviceTypes.$inferSelect;
export type NewServiceType = typeof serviceTypes.$inferInsert;
export type Language = typeof languages.$inferSelect;
export type NewLanguage = typeof languages.$inferInsert;
export type ContentTranslation = typeof contentTranslations.$inferSelect;
export type NewContentTranslation = typeof contentTranslations.$inferInsert;
export type BlogRevision = typeof blogRevisions.$inferSelect;
export type NewBlogRevision = typeof blogRevisions.$inferInsert;

// ── Reservation requests ─────────────────────────────────────────────────────

export const requestIntentEnum = pgEnum('request_intent', ['QUOTE', 'RESERVATION']);

export const requestStatusEnum = pgEnum('request_status', [
  'NEW', 'CONTACTED', 'QUOTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'SPAM', 'ARCHIVED',
]);

export const reservationRequests = pgTable('reservation_requests', {
  id:              uuid('id').primaryKey().defaultRandom(),
  referenceNumber: text('reference_number').notNull().unique(),
  intent:          requestIntentEnum('intent').notNull(),
  serviceType:     text('service_type').notNull(),
  name:            text('name').notNull(),
  phone:           text('phone').notNull(),
  normalizedEmail: text('normalized_email'),
  locale:          text('locale').default('tr').notNull(),
  requestData:     jsonb('request_data').notNull().default({}),
  status:          requestStatusEnum('status').default('NEW').notNull(),
  adminNotes:      text('admin_notes'),
  source:          text('source').default('booking-form').notNull(),
  createdAt:       timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt:      timestamp('archived_at', { withTimezone: true }),
});

// ── Newsletter ────────────────────────────────────────────────────────────────

export const newsletterStatusEnum = pgEnum('newsletter_status', [
  'PENDING', 'ACTIVE', 'UNSUBSCRIBED', 'SUPPRESSED',
]);

export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id:                uuid('id').primaryKey().defaultRandom(),
  normalizedEmail:   text('normalized_email').notNull().unique(),
  name:              text('name'),
  preferredLanguage: text('preferred_language').default('tr').notNull(),
  status:            newsletterStatusEnum('status').default('PENDING').notNull(),
  source:            text('source').notNull(),
  createdAt:         timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const newsletterConsentEvents = pgTable('newsletter_consent_events', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  subscriberId:       uuid('subscriber_id').references(() => newsletterSubscribers.id, { onDelete: 'cascade' }),
  normalizedEmail:    text('normalized_email').notNull(),
  action:             text('action').notNull(), // 'GRANTED' | 'WITHDRAWN'
  consentTextVersion: text('consent_text_version').notNull(),
  language:           text('language').notNull(),
  source:             text('source').notNull(),
  createdAt:          timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ReservationRequest    = typeof reservationRequests.$inferSelect;
export type NewReservationRequest = typeof reservationRequests.$inferInsert;
export type NewsletterSubscriber    = typeof newsletterSubscribers.$inferSelect;
export type NewNewsletterSubscriber = typeof newsletterSubscribers.$inferInsert;
export type NewsletterConsentEvent    = typeof newsletterConsentEvents.$inferSelect;
export type NewNewsletterConsentEvent = typeof newsletterConsentEvents.$inferInsert;

// ── Google Reviews ────────────────────────────────────────────────────────────

export const googleReviews = pgTable('google_reviews', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  reviewerName:          text('reviewer_name').notNull(),
  reviewText:            text('review_text').notNull(),
  rating:                integer('rating').notNull().default(5),
  reviewLanguage:        text('review_language').notNull().default('tr'),
  reviewDate:            timestamp('review_date', { withTimezone: true }),
  isVisible:             boolean('is_visible').notNull().default(true),
  sortOrder:             integer('sort_order').notNull().default(0),
  googleSourceIndicator: boolean('google_source_indicator').notNull().default(true),
  createdAt:             timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type GoogleReview    = typeof googleReviews.$inferSelect;
export type NewGoogleReview = typeof googleReviews.$inferInsert;

// ── Service Health Monitoring ─────────────────────────────────────────────────

/**
 * Records each scheduled health check run so the admin dashboard can display
 * "last checked at" without guessing.
 */
export const serviceHealthRuns = pgTable('service_health_runs', {
  id:             uuid('id').primaryKey().defaultRandom(),
  checkedAt:      timestamp('checked_at', { withTimezone: true }).defaultNow().notNull(),
  unhealthyCount: integer('unhealthy_count').notNull().default(0),
  /** Full JSON report from computeServiceHealthIssues — kept for audit trail. */
  result:         jsonb('result'),
});

/**
 * Tracks when the last alert email was sent for each slug so we can
 * rate-limit to at most one email per 6 hours per slug.
 */
export const serviceHealthAlerts = pgTable('service_health_alerts', {
  id:          uuid('id').primaryKey().defaultRandom(),
  slug:        text('slug').notNull().unique(),
  lastAlertAt: timestamp('last_alert_at', { withTimezone: true }).defaultNow().notNull(),
  issues:      jsonb('issues').$type<string[]>().notNull(),
});

export type ServiceHealthRun    = typeof serviceHealthRuns.$inferSelect;
export type NewServiceHealthRun = typeof serviceHealthRuns.$inferInsert;
export type ServiceHealthAlert    = typeof serviceHealthAlerts.$inferSelect;
export type NewServiceHealthAlert = typeof serviceHealthAlerts.$inferInsert;

// ── Chatbot ──────────────────────────────────────────────────────────────────

/**
 * One chat session per visitor browser tab (UUID generated client-side).
 * adminActiveUntil: while in the future, admin is "owning" this conversation
 * and AI will not auto-respond; expires after 5 minutes of admin inactivity.
 */
export const chatbotSessions = pgTable('chatbot_sessions', {
  id:               text('id').primaryKey(),
  visitorLang:      text('visitor_lang').notNull().default('tr'),
  adminActiveUntil: timestamp('admin_active_until', { withTimezone: true }),
  /** True once an admin has manually replied — AI will no longer auto-respond. */
  humanTakenOver:   boolean('human_taken_over').notNull().default(false),
  /**
   * When set, AI is on a 2-minute hold while admin has priority.
   * If admin replies → cleared immediately.
   * If timer elapses without a reply → AI resumes and clears this itself.
   */
  pendingAiAfter:   timestamp('pending_ai_after', { withTimezone: true }),
  /** When set, this session is archived/resolved and hidden from the active list. */
  resolvedAt:       timestamp('resolved_at',      { withTimezone: true }),
  createdAt:        timestamp('created_at',      { withTimezone: true }).defaultNow().notNull(),
  lastMessageAt:    timestamp('last_message_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Individual messages in a chatbot session.
 * role: 'user' (visitor), 'assistant' (AI), 'admin' (operator reply).
 * contentTr: Turkish translation of user messages for the admin panel.
 *            Null for assistant/admin messages (already Turkish-facing).
 */
export const chatbotMessages = pgTable('chatbot_messages', {
  id:        uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull().references(() => chatbotSessions.id, { onDelete: 'cascade' }),
  role:      text('role').notNull(),
  content:   text('content').notNull(),
  contentTr: text('content_tr'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ChatbotSession    = typeof chatbotSessions.$inferSelect;
export type NewChatbotSession = typeof chatbotSessions.$inferInsert;
export type ChatbotMessage    = typeof chatbotMessages.$inferSelect;
export type NewChatbotMessage = typeof chatbotMessages.$inferInsert;

/**
 * Single-row settings table (id always = 1).
 * aiTimeoutSeconds: how long after admin's last reply before AI resumes.
 */
export const chatbotSettings = pgTable('chatbot_settings', {
  id:               integer('id').primaryKey().default(1),
  aiTimeoutSeconds: integer('ai_timeout_seconds').notNull().default(60),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ChatbotSettings    = typeof chatbotSettings.$inferSelect;
export type NewChatbotSettings = typeof chatbotSettings.$inferInsert;

// ── Email Settings ───────────────────────────────────────────────────────────

/**
 * Singleton SMTP settings row — always upsert with id = 1.
 * smtp_pass_encrypted holds AES-256-GCM ciphertext from lib/email-crypto.ts.
 * The plaintext password is NEVER returned to the client.
 */
export const emailSettings = pgTable('email_settings', {
  id:                 integer('id').primaryKey().default(1),
  enabled:            boolean('enabled').default(false).notNull(),
  providerType:       text('provider_type').default('custom').notNull(),
  smtpHost:           text('smtp_host'),
  smtpPort:           integer('smtp_port').default(587),
  smtpSecure:         text('smtp_secure').default('tls').notNull(),
  smtpUser:           text('smtp_user'),
  smtpPassEncrypted:  text('smtp_pass_encrypted'),
  fromName:           text('from_name'),
  fromEmail:          text('from_email'),
  replyToEmail:       text('reply_to_email'),
  adminNotifyEmails:  text('admin_notify_emails'),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy:          uuid('updated_by').references(() => adminUsers.id, { onDelete: 'set null' }),
});

export type EmailSettings    = typeof emailSettings.$inferSelect;
export type NewEmailSettings = typeof emailSettings.$inferInsert;

// ── Translation Jobs ──────────────────────────────────────────────────────────

/**
 * Parent job for a bulk AI translation request.
 * One job = one entity translated into N languages.
 * Status: QUEUED → RUNNING → COMPLETED | PARTIAL | FAILED | CANCELLED
 */
export const translationJobs = pgTable('translation_jobs', {
  id:             uuid('id').primaryKey().defaultRandom(),
  entityType:     text('entity_type').notNull(),
  entityId:       uuid('entity_id').notNull(),
  /** QUEUED | RUNNING | COMPLETED | PARTIAL | FAILED | CANCELLED */
  status:         text('status').notNull().default('QUEUED'),
  /** When true, manually-locked translations may be overwritten. */
  force:          boolean('force').notNull().default(false),
  totalTasks:     integer('total_tasks').notNull().default(0),
  completedTasks: integer('completed_tasks').notNull().default(0),
  failedTasks:    integer('failed_tasks').notNull().default(0),
  createdBy:      uuid('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  createdAt:      timestamp('created_at',   { withTimezone: true }).defaultNow().notNull(),
  updatedAt:      timestamp('updated_at',   { withTimezone: true }).defaultNow().notNull(),
  completedAt:    timestamp('completed_at', { withTimezone: true }),
});

/**
 * One task per target language within a translation job.
 * Status lifecycle: QUEUED → RUNNING → COMPLETED | FAILED | RETRYING | CANCELLED
 */
export const translationJobTasks = pgTable('translation_job_tasks', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  jobId:              uuid('job_id').notNull().references(() => translationJobs.id, { onDelete: 'cascade' }),
  targetLanguageCode: text('target_language_code').notNull(),
  /** QUEUED | RUNNING | COMPLETED | FAILED | RETRYING | CANCELLED */
  status:             text('status').notNull().default('QUEUED'),
  /** Number of run attempts (includes retries). */
  attempts:           integer('attempts').notNull().default(0),
  /** Turkish-safe error message shown to the admin. */
  errorMessage:       text('error_message'),
  /** The contentTranslations row ID created/updated by this task. */
  translationId:      uuid('translation_id'),
  startedAt:          timestamp('started_at',   { withTimezone: true }),
  completedAt:        timestamp('completed_at', { withTimezone: true }),
  createdAt:          timestamp('created_at',   { withTimezone: true }).defaultNow().notNull(),
  updatedAt:          timestamp('updated_at',   { withTimezone: true }).defaultNow().notNull(),
});

export type TranslationJob    = typeof translationJobs.$inferSelect;
export type NewTranslationJob = typeof translationJobs.$inferInsert;
export type TranslationJobTask    = typeof translationJobTasks.$inferSelect;
export type NewTranslationJobTask = typeof translationJobTasks.$inferInsert;

export type TopicCluster    = typeof topicClusters.$inferSelect;
export type NewTopicCluster = typeof topicClusters.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// AI İçerik Stüdyosu (Content Studio) — Migration 0016
// ═══════════════════════════════════════════════════════════════════════════════

export const studioProjects = pgTable('studio_projects', {
  id:             uuid('id').primaryKey().defaultRandom(),
  contentType:    text('content_type').notNull().default('blog'),
  stage:          text('stage').notNull().default('setup'),
  status:         text('status').notNull().default('draft'),
  titleWorking:   text('title_working'),
  config:         jsonb('config').$type<Record<string, unknown>>().notNull().default({} as never),
  trContent:      jsonb('tr_content').$type<Record<string, unknown>>(),
  coverImageUrl:  text('cover_image_url'),
  coverImageAlt:  text('cover_image_alt'),
  trApprovedAt:   timestamp('tr_approved_at', { withTimezone: true }),
  trApprovedBy:   uuid('tr_approved_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  seoScore:       jsonb('seo_score').$type<Record<string, unknown>>(),
  cannibalization: jsonb('cannibalization').$type<Record<string, unknown>>(),
  cmsEntityId:    text('cms_entity_id'),
  cmsEntityType:  text('cms_entity_type'),
  scheduledFor:   timestamp('scheduled_for', { withTimezone: true }),
  publishedAt:    timestamp('published_at', { withTimezone: true }),
  createdBy:      uuid('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  createdAt:      timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const studioProjectTranslations = pgTable('studio_project_translations', {
  id:          uuid('id').primaryKey().defaultRandom(),
  projectId:   uuid('project_id').notNull().references(() => studioProjects.id, { onDelete: 'cascade' }),
  lang:        text('lang').notNull(),
  content:     jsonb('content').$type<Record<string, unknown>>(),
  status:      text('status').notNull().default('pending'),
  approvedAt:  timestamp('approved_at', { withTimezone: true }),
  approvedBy:  uuid('approved_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  aiModel:     text('ai_model'),
  aiTokens:    integer('ai_tokens').default(0),
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const studioImages = pgTable('studio_images', {
  id:              uuid('id').primaryKey().defaultRandom(),
  projectId:       uuid('project_id').notNull().references(() => studioProjects.id, { onDelete: 'cascade' }),
  objectPath:      text('object_path'),
  url:             text('url'),
  prompt:          text('prompt'),
  altText:         text('alt_text'),
  usageRights:     text('usage_rights').notNull().default('ai_generated'),
  status:          text('status').notNull().default('pending_approval'),
  rejectionReason: text('rejection_reason'),
  approvedAt:      timestamp('approved_at', { withTimezone: true }),
  approvedBy:      uuid('approved_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  createdAt:       timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const studioResearch = pgTable('studio_research', {
  id:         uuid('id').primaryKey().defaultRandom(),
  projectId:  uuid('project_id').notNull().references(() => studioProjects.id, { onDelete: 'cascade' }),
  url:        text('url'),
  title:      text('title'),
  accessedAt: timestamp('accessed_at', { withTimezone: true }).defaultNow(),
  claims:     jsonb('claims').$type<string[]>().notNull().default([]),
  sourceType: text('source_type').notNull().default('ai_context'),
  createdAt:  timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const studioDistribution = pgTable('studio_distribution', {
  id:         uuid('id').primaryKey().defaultRandom(),
  projectId:  uuid('project_id').notNull().references(() => studioProjects.id, { onDelete: 'cascade' }),
  platform:   text('platform').notNull(),
  content:    text('content').notNull().default(''),
  status:     text('status').notNull().default('draft'),
  createdAt:  timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:  timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const studioAudit = pgTable('studio_audit', {
  id:         uuid('id').primaryKey().defaultRandom(),
  projectId:  uuid('project_id').notNull().references(() => studioProjects.id, { onDelete: 'cascade' }),
  adminId:    uuid('admin_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  action:     text('action').notNull(),
  detail:     jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
  createdAt:  timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const studioSchedules = pgTable('studio_schedules', {
  id:              uuid('id').primaryKey().defaultRandom(),
  projectId:       uuid('project_id').notNull().references(() => studioProjects.id, { onDelete: 'cascade' }),
  scheduledFor:    timestamp('scheduled_for', { withTimezone: true }).notNull(),
  langs:           text('langs').array().notNull().default([]),
  idempotencyKey:  text('idempotency_key').notNull().unique(),
  status:          text('status').notNull().default('pending'),
  executedAt:      timestamp('executed_at', { withTimezone: true }),
  error:           text('error'),
  createdAt:       timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── Transfer Routes ───────────────────────────────────────────────────────────
// Shown on homepage "Popüler Transfer Bölgeleri" section; managed via admin.
export const transferRoutes = pgTable('transfer_routes', {
  id:                     uuid('id').primaryKey().defaultRandom(),
  slug:                   text('slug').notNull().unique(),
  name:                   text('name').notNull(),
  origin:                 text('origin').notNull(),
  destination:            text('destination').notNull(),
  distanceKm:             integer('distance_km').notNull(),
  durationMinutes:        integer('duration_minutes').notNull(),
  priceVitoMinEur:        integer('price_vito_min_eur').notNull(),
  priceVitoMaxEur:        integer('price_vito_max_eur').notNull(),
  priceSprinterMinEur:    integer('price_sprinter_min_eur').notNull(),
  priceSprinterMaxEur:    integer('price_sprinter_max_eur').notNull(),
  imagePath:              text('image_path'),
  displayOrder:           integer('display_order').default(0).notNull(),
  active:                 boolean('active').default(true).notNull(),
  /** JSONB: {"en":"…","de":"…","ru":"…","ar":"…","fr":"…","es":"…","it":"…","nl":"…"} */
  nameTranslations:       jsonb('name_translations').$type<Record<string, string>>(),
  originTranslations:     jsonb('origin_translations').$type<Record<string, string>>(),
  destinationTranslations: jsonb('destination_translations').$type<Record<string, string>>(),
  createdAt:              timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:              timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type TransferRoute = typeof transferRoutes.$inferSelect;
export type NewTransferRoute = typeof transferRoutes.$inferInsert;

// ── Custom Reservation Fields ─────────────────────────────────────────────────
// Admin-defined optional fields shown on the booking form per service.
export const customReservationFields = pgTable('custom_reservation_fields', {
  id:              serial('id').primaryKey(),
  label:           text('label').notNull(),
  appliesToSlugs:  jsonb('applies_to_slugs').notNull().default([]).$type<string[]>(),
  fieldType:       text('field_type').notNull().default('checkbox'),
  isActive:        boolean('is_active').notNull().default(true),
  sortOrder:       integer('sort_order').notNull().default(0),
  createdAt:       timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type CustomReservationField    = typeof customReservationFields.$inferSelect;
export type NewCustomReservationField = typeof customReservationFields.$inferInsert;

// Type aliases for jsonb columns (avoid circular import, define inline)
export type StudioConfigJson = Record<string, unknown>;
export type StudioContentJson = Record<string, unknown>;

export type StudioProject = typeof studioProjects.$inferSelect;
export type NewStudioProject = typeof studioProjects.$inferInsert;
export type StudioProjectTranslation = typeof studioProjectTranslations.$inferSelect;
export type NewStudioProjectTranslation = typeof studioProjectTranslations.$inferInsert;
export type StudioImage = typeof studioImages.$inferSelect;
export type StudioResearch = typeof studioResearch.$inferSelect;
export type StudioDistributionRow = typeof studioDistribution.$inferSelect;
export type StudioAuditRow = typeof studioAudit.$inferSelect;
export type StudioSchedule = typeof studioSchedules.$inferSelect;

// ── GSC (Google Search Console) connection ────────────────────────────────────

export const gscConnections = pgTable('gsc_connections', {
  id:             serial('id').primaryKey(),
  siteUrl:        text('site_url').notNull(),
  accessToken:    text('access_token'),
  refreshToken:   text('refresh_token').notNull(),
  tokenExpiry:    timestamp('token_expiry',    { withTimezone: true }),
  scope:          text('scope'),
  connectedEmail: text('connected_email'),
  connectedAt:    timestamp('connected_at',    { withTimezone: true }).defaultNow().notNull(),
  updatedAt:      timestamp('updated_at',      { withTimezone: true }).defaultNow().notNull(),
});

export type GscConnection    = typeof gscConnections.$inferSelect;
export type NewGscConnection = typeof gscConnections.$inferInsert;
