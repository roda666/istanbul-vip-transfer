CREATE TABLE "competitor_sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"label" text NOT NULL,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitor_sites_domain_unique" UNIQUE("domain")
);
