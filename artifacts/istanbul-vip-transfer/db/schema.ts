/**
 * Drizzle ORM schema — all database tables for the admin panel.
 * Phase 2 will connect these to the public-facing site.
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
  status: contentStatusEnum('status').default('DRAFT').notNull(),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  canonicalUrl: text('canonical_url'),
  indexable: boolean('indexable').default(true).notNull(),
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
