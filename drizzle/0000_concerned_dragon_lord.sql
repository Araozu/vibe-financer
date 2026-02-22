CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"current_balance" integer NOT NULL,
	"initial_balance" integer NOT NULL,
	"currency_code" text NOT NULL,
	"currency_symbol" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"stream_id" text NOT NULL,
	"state" jsonb NOT NULL,
	"version" integer NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"limit" integer NOT NULL,
	"currency_code" text NOT NULL,
	"period" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"current_spent" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_store" (
	"id" text PRIMARY KEY NOT NULL,
	"stream_id" text NOT NULL,
	"stream_type" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"version" integer NOT NULL,
	"user_id" text NOT NULL,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"name" text,
	"description" text,
	"category" text,
	"payee" text,
	"to_account_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"phone_number" text,
	"date_of_birth" timestamp with time zone,
	"preferred_currency" text DEFAULT 'USD',
	"timezone" text DEFAULT 'UTC',
	"age" integer,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget" ADD CONSTRAINT "budget_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_store" ADD CONSTRAINT "event_store_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_to_account_id_account_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_account_snapshot_stream" ON "account_snapshot" USING btree ("stream_id");--> statement-breakpoint
CREATE INDEX "idx_account_snapshot_version" ON "account_snapshot" USING btree ("stream_id","version");--> statement-breakpoint
CREATE INDEX "idx_event_store_stream" ON "event_store" USING btree ("stream_id","version");--> statement-breakpoint
CREATE INDEX "idx_event_store_stream_type" ON "event_store" USING btree ("stream_type");--> statement-breakpoint
CREATE INDEX "idx_event_store_event_type" ON "event_store" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_event_store_user" ON "event_store" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_event_store_occurred_at" ON "event_store" USING btree ("occurred_at");