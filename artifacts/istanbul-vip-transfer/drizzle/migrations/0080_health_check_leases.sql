-- Cross-instance lease preventing overlapping automated health checks.
CREATE TABLE IF NOT EXISTS "health_check_leases" (
  "lock_name" text PRIMARY KEY NOT NULL,
  "owner_token" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);