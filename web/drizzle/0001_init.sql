CREATE TABLE "api_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "api_token" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bookmark" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"type" text DEFAULT 'web' NOT NULL,
	"title" text,
	"description" text,
	"author" text,
	"site_name" text,
	"image_url" text,
	"published_at" timestamp,
	"content" text,
	"note" text,
	"summary" text,
	"key_points" jsonb,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"category_id" uuid,
	"category_locked" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"embedding" vector(1536),
	"search_vector" "tsvector",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "bookmark" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"color" text NOT NULL,
	"source" text DEFAULT 'ai' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "api_token" ADD CONSTRAINT "api_token_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark" ADD CONSTRAINT "bookmark_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark" ADD CONSTRAINT "bookmark_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_token_user_idx" ON "api_token" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookmark_user_url_idx" ON "bookmark" USING btree ("user_id","url");--> statement-breakpoint
CREATE INDEX "bookmark_user_created_idx" ON "bookmark" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "bookmark_user_category_idx" ON "bookmark" USING btree ("user_id","category_id");--> statement-breakpoint
CREATE INDEX "bookmark_embedding_idx" ON "bookmark" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "bookmark_search_idx" ON "bookmark" USING gin ("search_vector");--> statement-breakpoint
CREATE UNIQUE INDEX "category_user_slug_idx" ON "category" USING btree ("user_id","slug");--> statement-breakpoint
CREATE POLICY "bookmark_owner" ON "bookmark" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "bookmark"."user_id") WITH CHECK ((select auth.uid()) = "bookmark"."user_id");--> statement-breakpoint
CREATE POLICY "category_owner" ON "category" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "category"."user_id") WITH CHECK ((select auth.uid()) = "category"."user_id");