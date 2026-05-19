DROP INDEX "organizations_clerk_org_id_unique";--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "clerk_org_id" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_clerk_org_id_unique" ON "organizations" USING btree ("clerk_org_id") WHERE "organizations"."clerk_org_id" IS NOT NULL;