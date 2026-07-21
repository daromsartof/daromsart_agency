CREATE TABLE IF NOT EXISTS "signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"signer_name" text NOT NULL,
	"signer_email" text,
	"image_key" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"signed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "viewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "signed_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "pdf_signed_key" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "pdf_hash" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "signatures" ADD CONSTRAINT "signatures_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "signatures_quote_id_unique" ON "signatures" USING btree ("quote_id");