CREATE TABLE `account_snapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`stream_id` text NOT NULL,
	`state` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_account_snapshot_stream` ON `account_snapshot` (`stream_id`);--> statement-breakpoint
CREATE INDEX `idx_account_snapshot_version` ON `account_snapshot` (`stream_id`,`version`);