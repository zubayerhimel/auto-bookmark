ALTER TABLE "bookmark" ADD COLUMN "favorited_at" timestamp;--> statement-breakpoint
CREATE INDEX "bookmark_user_favorited_idx" ON "bookmark" USING btree ("user_id","favorited_at");