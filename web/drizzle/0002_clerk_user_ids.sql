DROP POLICY "bookmark_owner" ON "bookmark" CASCADE;--> statement-breakpoint
DROP POLICY "category_owner" ON "category" CASCADE;--> statement-breakpoint
ALTER TABLE "bookmark" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "category" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "api_token" DROP CONSTRAINT "api_token_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "bookmark" DROP CONSTRAINT "bookmark_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "category" DROP CONSTRAINT "category_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "api_token" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "bookmark" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "category" ALTER COLUMN "user_id" SET DATA TYPE text;
