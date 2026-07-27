CREATE TYPE "public"."admin_role" AS ENUM('SUPER_ADMIN', 'ADMIN', 'EDITOR');--> statement-breakpoint
CREATE TYPE "public"."ai_suggestion_status" AS ENUM('PENDING', 'IN_PROGRESS', 'COMPLETE', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('DRAFT', 'RESEARCH', 'REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."content_type" AS ENUM('PAGE', 'SERVICE', 'BLOG_POST');--> statement-breakpoint
CREATE TYPE "public"."nav_location" AS ENUM('HEADER', 'FOOTER', 'MOBILE');--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "admin_role" DEFAULT 'ADMIN' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "ai_content_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"suggested_title" text,
	"suggested_slug" text,
	"primary_keyword" text,
	"secondary_keywords" text,
	"search_intent" text,
	"suggested_outline" text,
	"target_service" text,
	"target_location" text,
	"article_type" text,
	"suggested_publish_date" timestamp with time zone,
	"status" "ai_suggestion_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" "content_type" NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text,
	"body" text,
	"hero_image" text,
	"hero_image_alt" text,
	"status" "content_status" DEFAULT 'DRAFT' NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"canonical_url" text,
	"indexable" boolean DEFAULT true NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "navigation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"href" text NOT NULL,
	"location" "nav_location" DEFAULT 'HEADER' NOT NULL,
	"parent_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"suggestion_id" uuid NOT NULL,
	"title" text,
	"url" text,
	"source_name" text,
	"accessed_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"business_name" text,
	"logo_path" text,
	"phone_display" text,
	"phone_international" text,
	"whatsapp_number" text,
	"email" text,
	"google_business_url" text,
	"address" text,
	"default_seo_title" text,
	"default_seo_description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_approved_by_admin_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_parent_id_navigation_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."navigation_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_sources" ADD CONSTRAINT "research_sources_suggestion_id_ai_content_suggestions_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."ai_content_suggestions"("id") ON DELETE cascade ON UPDATE no action;