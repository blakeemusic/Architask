ALTER TABLE "honoraire_contracts" ADD COLUMN "signed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "honoraire_contracts" ADD COLUMN "signed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "honoraire_situations" ADD COLUMN "signed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "honoraire_situations" ADD COLUMN "signed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "honoraire_contracts" ADD CONSTRAINT "honoraire_contracts_signed_by_user_id_users_id_fk" FOREIGN KEY ("signed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honoraire_situations" ADD CONSTRAINT "honoraire_situations_signed_by_user_id_users_id_fk" FOREIGN KEY ("signed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;