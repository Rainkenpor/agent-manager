CREATE TABLE `mcp_user_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`mcp_server_id` text NOT NULL REFERENCES `mcp_servers`(`id`) ON DELETE CASCADE,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);

CREATE UNIQUE INDEX `mcp_user_cred_unique` ON `mcp_user_credentials` (`user_id`, `mcp_server_id`, `key`);
