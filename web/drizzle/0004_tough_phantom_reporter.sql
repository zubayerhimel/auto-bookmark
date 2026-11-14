ALTER TABLE "bookmark" ADD COLUMN "link_status" text;--> statement-breakpoint
ALTER TABLE "bookmark" ADD COLUMN "link_checked_at" timestamp;--> statement-breakpoint
CREATE INDEX "bookmark_link_checked_idx" ON "bookmark" USING btree ("link_checked_at");