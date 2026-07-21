CREATE TABLE IF NOT EXISTS "email_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"document_id" uuid NOT NULL,
	"kind" text DEFAULT 'document' NOT NULL,
	"to" jsonb NOT NULL,
	"cc" jsonb,
	"subject" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"resend_id" text,
	"error_message" text,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"opened_at" timestamp,
	"bounced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "email_defaults" SET DEFAULT '{"quote":{"subject":"Votre devis {numero}","body":"Bonjour {client},\n\nVeuillez trouver ci-joint notre devis {numero} d''un montant de {total}.\n\nVous pouvez le consulter et le signer en ligne : {lien}\n\nCe devis est valable jusqu''au {echeance}.\n\nN''hésitez pas à nous contacter pour toute question.\n\nCordialement."},"invoice":{"subject":"Votre facture {numero}","body":"Bonjour {client},\n\nVeuillez trouver ci-joint notre facture {numero} d''un montant de {total}, à régler avant le {echeance}.\n\nVous pouvez la consulter en ligne : {lien}\n\nCordialement."},"reminder":{"subject":"Rappel — facture {numero} en attente de règlement","body":"Bonjour {client},\n\nSauf erreur de notre part, notre facture {numero} d''un montant de {total}, échue le {echeance}, demeure impayée à ce jour.\n\nVous pouvez la consulter et procéder au règlement ici : {lien}\n\nMerci de bien vouloir régulariser dans les meilleurs délais.\n\nCordialement."}}'::jsonb;--> statement-breakpoint
-- Backfill des lignes existantes (colonne nullable jusqu'ici, story 04) avant
-- de poser NOT NULL, sinon échec de la contrainte (piège H21, migration 0001).
UPDATE "organizations" SET "email_defaults" = '{"quote":{"subject":"Votre devis {numero}","body":"Bonjour {client},\n\nVeuillez trouver ci-joint notre devis {numero} d''un montant de {total}.\n\nVous pouvez le consulter et le signer en ligne : {lien}\n\nCe devis est valable jusqu''au {echeance}.\n\nN''hésitez pas à nous contacter pour toute question.\n\nCordialement."},"invoice":{"subject":"Votre facture {numero}","body":"Bonjour {client},\n\nVeuillez trouver ci-joint notre facture {numero} d''un montant de {total}, à régler avant le {echeance}.\n\nVous pouvez la consulter en ligne : {lien}\n\nCordialement."},"reminder":{"subject":"Rappel — facture {numero} en attente de règlement","body":"Bonjour {client},\n\nSauf erreur de notre part, notre facture {numero} d''un montant de {total}, échue le {echeance}, demeure impayée à ce jour.\n\nVous pouvez la consulter et procéder au règlement ici : {lien}\n\nMerci de bien vouloir régulariser dans les meilleurs délais.\n\nCordialement."}}'::jsonb WHERE "email_defaults" IS NULL;--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "email_defaults" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
