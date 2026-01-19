CREATE TABLE `event_store` (
	`id` text PRIMARY KEY NOT NULL,
	`stream_id` text NOT NULL,
	`stream_type` text NOT NULL,
	`event_type` text NOT NULL,
	`payload` text NOT NULL,
	`version` integer NOT NULL,
	`user_id` text NOT NULL,
	`metadata` text,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_event_store_stream` ON `event_store` (`stream_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_event_store_stream_type` ON `event_store` (`stream_type`);--> statement-breakpoint
CREATE INDEX `idx_event_store_event_type` ON `event_store` (`event_type`);--> statement-breakpoint
CREATE INDEX `idx_event_store_user` ON `event_store` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_event_store_occurred_at` ON `event_store` (`occurred_at`);