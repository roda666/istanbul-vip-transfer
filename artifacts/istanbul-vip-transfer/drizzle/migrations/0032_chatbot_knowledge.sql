CREATE TABLE "chatbot_knowledge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"question" text,
	"answer" text NOT NULL,
	"category" text,
	"language" text DEFAULT 'tr' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chatbot_knowledge" ADD CONSTRAINT "chatbot_knowledge_source_id_chatbot_knowledge_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."chatbot_knowledge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chatbot_knowledge_active_language_idx" ON "chatbot_knowledge" USING btree ("is_active","language");--> statement-breakpoint
CREATE UNIQUE INDEX "chatbot_knowledge_source_language_unique" ON "chatbot_knowledge" USING btree ("source_id","language");