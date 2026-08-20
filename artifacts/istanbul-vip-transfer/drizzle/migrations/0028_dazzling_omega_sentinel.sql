CREATE TABLE "social_platforms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"auth_type" text DEFAULT 'manual' NOT NULL,
	"required_secrets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"connected" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"access_token_encrypted" text,
	"access_token_secret_encrypted" text,
	"connection_meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_publish_id" text,
	"last_publish_url" text,
	"last_error" text,
	"connected_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_platforms_key_unique" UNIQUE("key")
);
