ALTER TABLE "companies" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "moas" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "companies_archived_idx" ON "companies" USING btree ("organization_id","archived_at");--> statement-breakpoint
CREATE INDEX "moas_archived_idx" ON "moas" USING btree ("organization_id","archived_at");