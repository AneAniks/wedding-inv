CREATE TABLE `responses` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`update_token_hash` text NOT NULL,
	`full_name` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`attendance` text NOT NULL,
	`guest_count` integer NOT NULL,
	`companions` text NOT NULL,
	`dietary` text DEFAULT '' NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `responses_request_id_unique` ON `responses` (`request_id`);