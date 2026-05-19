ALTER TABLE "insurances" DROP CONSTRAINT "insurances_montant_positive_ck";--> statement-breakpoint
ALTER TABLE "insurances" ALTER COLUMN "montant_garanti" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "insurances" ADD CONSTRAINT "insurances_montant_positive_ck" CHECK ("insurances"."montant_garanti" IS NULL OR "insurances"."montant_garanti" >= 0);