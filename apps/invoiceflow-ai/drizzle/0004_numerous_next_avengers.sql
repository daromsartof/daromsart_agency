ALTER TABLE "quotes" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "refused_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "refusal_reason" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quotes_share_token_unique" ON "quotes" USING btree ("share_token");