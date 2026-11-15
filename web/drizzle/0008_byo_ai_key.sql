CREATE TABLE "ai_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"key_hint" text NOT NULL,
	"model" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bookmark" ADD COLUMN "embedding_model" text;--> statement-breakpoint
-- Vectors saved before this were made with the server key's default embedding model.
UPDATE "bookmark" SET "embedding_model" = 'openai/text-embedding-3-small' WHERE "embedding" IS NOT NULL;