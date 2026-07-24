ALTER TABLE "signatures" ALTER COLUMN "quote_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "signatures" ADD COLUMN "invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "signed_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "pdf_signed_key" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "pdf_hash" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "signatures" ADD CONSTRAINT "signatures_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "signatures_invoice_id_unique" ON "signatures" USING btree ("invoice_id");--> statement-breakpoint
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_exactly_one_parent" CHECK ((("signatures"."quote_id" IS NOT NULL)::int + ("signatures"."invoice_id" IS NOT NULL)::int) = 1);