ALTER TABLE "transaction" DROP CONSTRAINT IF EXISTS "transaction_to_account_id_account_id_fk";--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_to_account_id_account_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;
