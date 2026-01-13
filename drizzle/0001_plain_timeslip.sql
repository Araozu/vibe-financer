CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`current_balance` integer NOT NULL,
	`initial_balance` integer NOT NULL,
	`currency_code` text NOT NULL,
	`currency_symbol` text NOT NULL,
	`color` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
