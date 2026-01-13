ALTER TABLE `user` ADD `name` text;--> statement-breakpoint
ALTER TABLE `user` ADD `email` text;--> statement-breakpoint
ALTER TABLE `user` ADD `default_currency_code` text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `default_currency_symbol` text DEFAULT '$' NOT NULL;