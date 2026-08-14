/**
 * Drizzle ORM schema — all database tables for the admin panel.
 */
import {
  pgTable,
  pgEnum,
  text,
  boolean,
  integer,
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
]);

export const contentTypeEnum = pgEnum('content_type', [
  'PAGE',
  'SERVICE',
  'BLOG_POST',
]);

export const contentStatusEnum = pgEnum('content_status', [
  'DRAFT',
  'RESEARCH',
  'REVIEW',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
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
  /** Service category — e.g. 'airport', 'intercity', 'tour', 'corporate', 'health', 'vip', 'rental' */
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

export const aiContentSuggestions = pgTable('ai_content_suggestions', {
  id: uuid('id').primaryKey().defaultRandom(),
  suggestedTitle: text('suggested_title'),
  suggestedSlug: text('suggested_slug'),
  primaryKeyword: text('primary_keyword'),
  secondaryKeywords: text('secondary_keywords'),
  searchIntent: text('search_intent'),
  suggestedOutline: text('suggested_outline'),
  targetService: text('target_service'),
  targetLocation: text('target_location'),
  articleType: text('article_type'),
  suggestedPublishDate: timestamp('suggested_publish_date', { withTimezone: true }),
  status: aiSuggestionStatusEnum('status').default('PENDING').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const researchSources = pgTable('research_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  suggestionId: uuid('suggestion_id')
    .notNull()
    .references(() => aiContentSuggestions.id, { onDelete: 'cascade' }),
  title: text('title'),
  url: text('url'),
  sourceName: text('source_name'),
  accessedAt: timestamp('accessed_at', { withTimezone: true }),
  notes: text('notes'),
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
