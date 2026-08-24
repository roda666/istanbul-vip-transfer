CREATE TABLE "email_encryption_keys" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"wrapped_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);