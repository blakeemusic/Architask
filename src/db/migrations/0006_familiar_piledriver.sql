ALTER TABLE "dgds" ADD COLUMN "signed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dgds" ADD COLUMN "signed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "pv_receptions" ADD COLUMN "signed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pv_receptions" ADD COLUMN "signed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "retentions" ADD COLUMN "substituted_by_caution_id" uuid;--> statement-breakpoint
ALTER TABLE "dgds" ADD CONSTRAINT "dgds_signed_by_user_id_users_id_fk" FOREIGN KEY ("signed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pv_receptions" ADD CONSTRAINT "pv_receptions_signed_by_user_id_users_id_fk" FOREIGN KEY ("signed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retentions" ADD CONSTRAINT "retentions_substituted_by_caution_id_cautions_id_fk" FOREIGN KEY ("substituted_by_caution_id") REFERENCES "public"."cautions"("id") ON DELETE set null ON UPDATE no action;