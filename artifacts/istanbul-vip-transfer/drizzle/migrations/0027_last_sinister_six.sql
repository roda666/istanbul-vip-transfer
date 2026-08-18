CREATE TABLE "google_ads_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"access_token" text,
	"refresh_token" text NOT NULL,
	"token_expiry" timestamp with time zone,
	"scope" text,
	"connected_email" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
