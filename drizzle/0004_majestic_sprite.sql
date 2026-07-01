CREATE TABLE "todo_item" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "todo_item" ADD CONSTRAINT "todo_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_todo_item_user" ON "todo_item" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_todo_item_order" ON "todo_item" USING btree ("sort_order");