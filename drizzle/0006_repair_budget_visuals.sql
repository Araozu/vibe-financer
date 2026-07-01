ALTER TABLE "budget" ADD COLUMN IF NOT EXISTS "icon" text DEFAULT 'piggy-bank' NOT NULL;--> statement-breakpoint
ALTER TABLE "budget" ADD COLUMN IF NOT EXISTS "color" text DEFAULT '#ff3b6b' NOT NULL;
