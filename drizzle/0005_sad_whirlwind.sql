ALTER TABLE `user` ADD `first_name` text;--> statement-breakpoint
ALTER TABLE `user` ADD `last_name` text;--> statement-breakpoint
ALTER TABLE `user` ADD `phone_number` text;--> statement-breakpoint
ALTER TABLE `user` ADD `date_of_birth` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `preferred_currency` text DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE `user` ADD `timezone` text DEFAULT 'UTC';