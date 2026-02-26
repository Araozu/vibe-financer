DROP INDEX "idx_event_store_stream";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "default_account_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_event_store_stream" ON "event_store" USING btree ("stream_id","version");